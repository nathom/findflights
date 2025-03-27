from flask import Flask, request, jsonify
import asyncio
import datetime
from lib import (
    create_browser,
    parse_date,
    parse_date_range,
    run_tasks,
    pair_flights,
    search_flights,
    parse_duration_str,
)

# For async support in Flask
from asgiref.wsgi import WsgiToAsgi
from hypercorn.asyncio import serve
from hypercorn.config import Config as HyperConfig

# Graph validation functions
def find_cycles(flights):
    # build an index: source -> list of flights
    flights_by_source = {}
    for flight in flights:
        flights_by_source.setdefault(flight['source'], []).append(flight)

    cycles = []

    def dfs(node, start, path, visited):
        # if we loop back to start (and path is non-empty) record a cycle
        if node in visited:
            if node == start and path:
                cycles.append(path)
            return
        # add current node to visited (copy to avoid affecting other dfs branches)
        for flight in flights_by_source.get(node, []):
            dfs(flight['target'], start, path + [flight], visited | {node})

    # run dfs from every node
    nodes = set()
    for flight in flights:
        nodes.add(flight['source'])
        nodes.add(flight['target'])
    for node in nodes:
        dfs(node, node, [], set())
    return cycles

def is_time_respecting(cycle):
    # a cycle is time-respecting if each flight's departure is strictly after the previous flight's arrival
    if not cycle:
        return True
    current_arrival = None
    for flight in cycle:
        if current_arrival is not None and flight['departure'] <= current_arrival:
            return False
        current_arrival = flight['arrival']
    return True

def validate_graph(flights):
    # check every cycle for time-respecting order
    cycles = find_cycles(flights)
    for cycle in cycles:
        if not is_time_respecting(cycle):
            return False, cycle
    return True, None

def dfs_unroll(current_node, current_time, flights, path, results, depth, max_depth):
    if depth >= max_depth:
        results.append(path)
        return
    extended = False
    for flight in flights:
        if flight['source'] == current_node and flight['departure'] > current_time:
            extended = True
            dfs_unroll(flight['target'], flight['arrival'], flights, path + [flight], results, depth + 1, max_depth)
    if not extended:
        results.append(path)

def unroll_graph(flights, start_node, start_time, max_depth=10):
    # check validity first: if any cycle is not time-respecting, raise an error
    is_valid, invalid_cycle = validate_graph(flights)
    if not is_valid:
        raise ValueError(f"Graph contains cycles that are not time-respecting: {invalid_cycle}")
    
    results = []
    dfs_unroll(start_node, start_time, flights, [], results, 0, max_depth)
    return results

app = Flask(__name__, static_folder='ui/build', static_url_path='')
browser = None
playwright = None


# Create initialization function
async def init_browser():
    global browser, playwright
    if browser is None:
        browser, playwright = await create_browser()


@app.route('/')
def index():
    return app.send_static_file('index.html')


@app.route('/api/search', methods=['POST'])
async def search():
    # Ensure browser is initialized
    await init_browser()
    
    data = request.json
    
    # Extract common parameters
    top = data.get('top', 5)
    sort_metric = data.get('sort', 'price')
    exclude_airlines = [x.strip().lower() for x in data.get('exclude', '').split(',') if x.strip()]
    depart_time_range = data.get('departTimeRange')
    direct = data.get('direct', True)
    workers = data.get('workers', 5)
    
    # Handle different graph types
    search_type = data.get('type', 'round_trip')
    
    if search_type == 'custom':
        # Process custom graph structure
        graph_data = data.get('graphData', {})
        nodes = graph_data.get('nodes', [])
        edges = graph_data.get('edges', [])
        
        # Here we would implement advanced graph processing logic
        # For now, return an error that this is not yet implemented
        return jsonify({'error': 'Custom graph search not yet implemented'}), 501
    
    # For round_trip and flexible_tour, extract standard parameters
    sources = [s.strip().upper() for s in data.get('origin', '').split(',')]
    dests = [d.strip().upper() for s in data.get('destinations', '').split(',')]
    depart_range = data.get('depart', '')
    return_range = data.get('return', '')
    weekend = data.get('weekend')
    
    # For flexible tour, extract additional parameters
    if search_type == 'flexible_tour':
        required_cities = [c.strip().upper() for c in data.get('requiredCities', '').split(',') if c.strip()]
        optional_cities = [c.strip().upper() for c in data.get('optionalCities', '').split(',') if c.strip()]
        min_visits = data.get('minVisits', 0)
        max_visits = data.get('maxVisits', 0)
    
    # Process weekend selection
    if weekend:
        try:
            today = datetime.date.today()
            weekend_date = parse_date(weekend, default_year=today.year)
            wd = weekend_date.weekday()
            if wd not in (4, 5, 6, 0):
                return jsonify({'error': f'Provided weekend date {weekend} is not part of a weekend (fri-sat-sun-mon)'}), 400
            if wd == 4:
                friday_date = weekend_date
            elif wd == 5:
                friday_date = weekend_date - datetime.timedelta(days=1)
            elif wd == 6:
                friday_date = weekend_date - datetime.timedelta(days=2)
            elif wd == 0:
                friday_date = weekend_date - datetime.timedelta(days=3)
            depart_dates = [friday_date, friday_date + datetime.timedelta(days=1)]
            return_dates = [
                friday_date + datetime.timedelta(days=2),
                friday_date + datetime.timedelta(days=3),
            ]
        except Exception as e:
            return jsonify({'error': f'Error parsing weekend date: {e}'}), 400
    else:
        try:
            depart_dates = parse_date_range(depart_range)
            if return_range:
                return_dates = parse_date_range(return_range)
            else:
                return_dates = None
        except Exception as e:
            return jsonify({'error': f'Error parsing date(s): {e}'}), 400
    
    # Build search tasks
    outbound_tasks = []
    inbound_tasks = []
    for src in sources:
        for dest in dests:
            for d in depart_dates:
                outbound_tasks.append(search_flights(src, dest, d, browser))
    if return_dates:
        for dest in dests:
            for src in sources:
                for d in return_dates:
                    inbound_tasks.append(search_flights(dest, src, d, browser))
    
    # Execute searches
    outbound_flights = []
    for i in range(0, len(outbound_tasks), workers):
        batch = outbound_tasks[i : i + workers]
        try:
            results = await run_tasks(batch)
            outbound_flights.extend([flight for flights in results for flight in flights])
        except Exception as exc:
            return jsonify({'error': f'Outbound task error: {exc}'}), 500
    
    if return_dates:
        inbound_flights = []
        for i in range(0, len(inbound_tasks), workers):
            batch = inbound_tasks[i : i + workers]
            try:
                results = await run_tasks(batch)
                inbound_flights.extend([flight for flights in results for flight in flights])
            except Exception as exc:
                return jsonify({'error': f'Inbound task error: {exc}'}), 500
    else:
        inbound_flights = []
    
    # Process results
    if not outbound_flights:
        return jsonify({'error': 'No outbound flights found'}), 404
    if return_dates and not inbound_flights:
        return jsonify({'error': 'No inbound flights found'}), 404
    
    if return_dates:
        all_pairs = pair_flights(outbound_flights, inbound_flights)
        if exclude_airlines:
            all_pairs = [
                p for p in all_pairs
                if p["out_airline"].lower() not in exclude_airlines
                and p["in_airline"].lower() not in exclude_airlines
            ]
            
        # Sort flights
        if sort_metric == "price":
            sorted_pairs = sorted(all_pairs, key=lambda x: x.get("total_cost", 0))
        elif sort_metric == "total time":
            sorted_pairs = sorted(
                all_pairs, 
                key=lambda x: x["stay_dur"] if x["stay_dur"] is not None else float("inf"),
            )
        else:
            sorted_pairs = all_pairs
            
        # Filter direct flights if needed
        if direct:
            sorted_pairs = [
                p for p in sorted_pairs
                if "nonstop" in p["out_stops"].lower() and "nonstop" in p["in_stops"].lower()
            ]
            
        # Apply departure time range filter
        if depart_time_range:
            try:
                start_str, end_str = depart_time_range.split("-")
                start_time = datetime.datetime.strptime(start_str, "%H:%M").time()
                end_time = datetime.datetime.strptime(end_str, "%H:%M").time()
                filtered = []
                for p in sorted_pairs:
                    try:
                        dep = datetime.datetime.strptime(p["out_dep_time"], "%H:%M").time()
                        if start_time <= dep <= end_time:
                            filtered.append(p)
                    except Exception:
                        continue
                sorted_pairs = filtered
            except Exception as e:
                return jsonify({'error': f'Error parsing depart time range: {e}'}), 400
                
        # Return top results
        return jsonify({'results': sorted_pairs[:top], 'total': len(sorted_pairs)})
        
    else:
        # One-way flight processing
        if exclude_airlines:
            outbound_flights = [
                f for f in outbound_flights
                if f["airline"].lower() not in exclude_airlines
            ]
            
        # Filter by direct
        if direct:
            outbound_flights = [f for f in outbound_flights if "nonstop" in f.get("stops", "").lower()]
            
        # Filter by departure time
        if depart_time_range:
            try:
                start_str, end_str = depart_time_range.split("-")
                start_time = datetime.datetime.strptime(start_str, "%H:%M").time()
                end_time = datetime.datetime.strptime(end_str, "%H:%M").time()
                outbound_flights = [
                    f for f in outbound_flights
                    if start_time <= datetime.datetime.strptime(f.get("dep_time", "00:00"), "%H:%M").time() <= end_time
                ]
            except Exception as e:
                return jsonify({'error': f'Error parsing depart time range: {e}'}), 400
                
        # Sort flights
        if sort_metric == "price":
            sorted_flights = sorted(outbound_flights, key=lambda x: x.get("cost", 0))
        elif sort_metric == "duration":
            sorted_flights = sorted(
                outbound_flights, 
                key=lambda x: parse_duration_str(x.get("duration", ""))
            )
        else:
            sorted_flights = outbound_flights
            
        # Return top results
        return jsonify({'results': sorted_flights[:top], 'total': len(sorted_flights)})


@app.route('/api/validate', methods=['POST'])
async def validate_route():
    data = request.json
    flights = data.get('flights', [])
    try:
        is_valid, invalid_cycle = validate_graph(flights)
        if is_valid:
            return jsonify({'valid': True, 'message': 'Graph is valid'})
        else:
            return jsonify({
                'valid': False, 
                'message': 'Graph contains cycles that are not time-respecting',
                'invalid_cycle': invalid_cycle
            })
    except Exception as e:
        return jsonify({'valid': False, 'message': str(e)})

@app.route('/api/unroll', methods=['POST'])
async def unroll_route():
    data = request.json
    flights = data.get('flights', [])
    start_node = data.get('start_node')
    start_time = data.get('start_time', 0)
    max_depth = data.get('max_depth', 10)
    
    try:
        paths = unroll_graph(flights, start_node, start_time, max_depth)
        formatted_paths = []
        for p in paths:
            if p:
                # Format the path for response
                route = []
                for i, f in enumerate(p):
                    # Add source node
                    route.append({
                        'node': f['source'],
                        'departure': f['departure'],
                        'arrival': f['arrival']
                    })
                    # Add target node if this is the last flight
                    if i == len(p) - 1:
                        route.append({
                            'node': f['target']
                        })
                formatted_paths.append(route)
            else:
                # Just the start node if there are no flights
                formatted_paths.append([{'node': start_node}])
        
        return jsonify({
            'valid': True,
            'paths': formatted_paths
        })
    except ValueError as e:
        return jsonify({
            'valid': False,
            'message': str(e)
        })

@app.route('/api/airports', methods=['GET'])
def get_airports():
    # Common airports list - this can be expanded or loaded from a file
    airports = [
        {"code": "ATL", "name": "Atlanta Hartsfield-Jackson"},
        {"code": "LAX", "name": "Los Angeles International"},
        {"code": "ORD", "name": "Chicago O'Hare"},
        {"code": "DFW", "name": "Dallas/Fort Worth"},
        {"code": "DEN", "name": "Denver International"},
        {"code": "JFK", "name": "New York John F. Kennedy"},
        {"code": "SFO", "name": "San Francisco International"},
        {"code": "SEA", "name": "Seattle-Tacoma"},
        {"code": "LAS", "name": "Las Vegas McCarran"},
        {"code": "MCO", "name": "Orlando International"},
        {"code": "EWR", "name": "Newark Liberty"},
        {"code": "PHX", "name": "Phoenix Sky Harbor"},
        {"code": "IAH", "name": "Houston George Bush"},
        {"code": "MIA", "name": "Miami International"},
        {"code": "BOS", "name": "Boston Logan"},
        {"code": "MSP", "name": "Minneapolis-St. Paul"},
        {"code": "DTW", "name": "Detroit Metro Wayne County"},
        {"code": "FLL", "name": "Fort Lauderdale-Hollywood"},
        {"code": "PHL", "name": "Philadelphia International"},
        {"code": "CLT", "name": "Charlotte Douglas"},
        {"code": "SAN", "name": "San Diego International"},
        {"code": "SLC", "name": "Salt Lake City International"},
        {"code": "IAD", "name": "Washington Dulles International"},
        {"code": "DCA", "name": "Washington Ronald Reagan"},
        {"code": "MDW", "name": "Chicago Midway"},
        {"code": "SNA", "name": "John Wayne (Orange County)"},
        {"code": "OAK", "name": "Oakland International"},
        {"code": "SJC", "name": "San Jose International"},
        {"code": "SMF", "name": "Sacramento International"},
        {"code": "LGB", "name": "Long Beach Airport"},
        {"code": "BUR", "name": "Hollywood Burbank Airport"}
    ]
    return jsonify(airports)


@app.route('/api/trip-types', methods=['GET'])
def get_trip_types():
    # For the advanced UI functionality discussed in the conversation
    trip_types = [
        {
            "id": "round_trip",
            "name": "Round Trip",
            "description": "Standard round trip between airports"
        },
        {
            "id": "one_way",
            "name": "One Way",
            "description": "Single flight without return"
        },
        {
            "id": "open_jaw",
            "name": "Open Jaw",
            "description": "Fly into one city, return from another"
        },
        {
            "id": "multi_city",
            "name": "Multi-City",
            "description": "Visit multiple cities in sequence"
        },
        {
            "id": "flexible_tour",
            "name": "Flexible Tour",
            "description": "Visit multiple cities with flexible ordering"
        }
    ]
    return jsonify(trip_types)


# Create ASGI app from WSGI app
asgi_app = WsgiToAsgi(app)

async def start_server():
    config = HyperConfig()
    config.bind = ["localhost:5000"]
    await serve(asgi_app, config)

if __name__ == '__main__':
    print("Starting FindFlights server on http://localhost:5000")
    asyncio.run(start_server())