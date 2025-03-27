

i'm making an app that computes optimal (cheapest) flight configurations from a loose vacation schedule. for example the person may not care which airport theyre flying to and have a range of dates that are acceptable. here's the interface for the cli rn:

usage: main.py [-h] [--depart DEPART] [--return RETURN_RANGE] [--weekend WEEKEND] [--top TOP] [--sort {price,total time}] [--exclude EXCLUDE]
               [--save-csv SAVE_CSV] [--depart-time-range DEPART_TIME_RANGE] [--direct | --no-direct] [--workers WORKERS]
               origin destinations

cli for round-trip flight search via headless browser simulation (parallel)

positional arguments:
  origin                comma separated candidate source airports (e.g. SAN,SNA,LAX)
  destinations          comma separated candidate destination airports (e.g. SFO,OAK,SJC)

options:
  -h, --help            show this help message and exit
  --depart DEPART       outbound date or date range (e.g. 3/7 or 3/7-3/8)
  --return RETURN_RANGE
                        return date or date range (e.g. 3/9 or 3/9-3/10)
  --weekend WEEKEND     specify a date (mm/dd or mm/dd/yyyy) for a weekend trip; computes depart as friday/saturday and return as sunday/monday
  --top TOP             number of top results to show (default 5)
  --sort {price,total time}
                        metric to sort by (default price)
  --exclude EXCLUDE     comma separated list of airlines to exclude (default none)
  --save-csv SAVE_CSV   path to save full sorted results as csv (default none)
  --depart-time-range DEPART_TIME_RANGE
                        filter outbound departures within time range, e.g. '08:00-12:00'
  --direct              only show direct flights (default)
  --no-direct           include flights with stops
  --workers WORKERS     number of threadpool workers (default 5)


i want to create a UI that would make sense for this. however i also want to add features that allow more complex routes and constraints. eg maybe we want to depart from and return do different sets of airports, which the cli doesnt support rn but can be supported.

what would be a good UI design for this app? rn i'm thinking like a directed graph
(would it be acyclic idk) with nodes as sets of possible destinations and arrows as a path.

idk if that makes sense, but you can help be design something that works in theory

# Flight Planning UI Design

## Core UI Components

1. **Main Interface**: A graph-based visual representation with regions/cities as nodes and flights as edges.

2. **Trip Builder Panel**: A sequential list of trip segments with expandable options for each.

3. **Constraint Controls**: For global trip parameters like budget, airline preferences, etc.

## User Interaction Flow

```
+-----------------+     +------------------+     +----------------+
| Select Trip Type | --> | Configure Stages | --> | View Solutions |
+-----------------+     +------------------+     +----------------+
                                |
                                v
                         +------------------+
                         | Refine Parameters |
                         +------------------+
```

## Detailed Design

### 1. Trip Type Selection
- Simple Round Trip (existing functionality)
- Multi-City Trip (new)
- Open Jaw (different departure and return airports)
- Flexible Exploration (date/destination flexible)

### 2. Trip Builder Interface

For each trip segment:

```
[FROM] --> [TO]
   |         |
   v         v
[Date Range][Date Range]
   |         |
   v         v
[Time Prefs][Time Prefs]
```

- FROM/TO: Can be single airports or sets (e.g., "Bay Area Airports")
- Date ranges: Visual calendar selection with price indicators
- Time preferences: Sliders for departure/arrival windows

### 3. Constraint Layer

Global constraints applied to all segments:
- Budget sliders
- Airline inclusions/exclusions
- Max layovers
- Minimum layover duration
- Priority weighting (price vs. time vs. comfort)

### 4. Results View

Two modes:
1. **List View**: Traditional sorted results with expandable details
2. **Timeline View**: Visual representation of trip with segments, layovers

## Implementation Considerations

1. The graph structure should be a directed multigraph, not necessarily acyclic since loops (returning to same location) are valid.

2. Optimization algorithm needs to handle combinatorial complexity with constraints:
   - Use progressive filtering
   - Allow partial solutions display while optimizing

3. UI should scale from simple to complex use cases:
   - Initially show minimal interface
   - Expand options as user specifies more complex requirements

This design supports both the existing CLI functionality and more complex routing scenarios while maintaining an intuitive interface for casual users.

ok i didnt mean the literal UI components we can think about that later. i want you
to think through the graph idea. what kind of graph would it be? what is the structure? what are nodes and edges? what info do they contain?

# Flight Planning Graph Structure

## Core Graph Model

The flight planning problem can be modeled as a directed, weighted, temporal multigraph.

## Graph Components

### Nodes
Nodes represent **location sets at specific time ranges**:
- Each node = (Airport Set, Time Range)
- Example: ({SFO, OAK, SJC}, March 7-8, 2024)

### Edges
Edges represent **possible flights** between nodes:
- Each edge = (Flight Options, Constraints)
- Multiple edges can exist between the same node pair (hence multigraph)
- Edges contain all valid flights between the location sets within time constraints

### Edge Weights
Edges have multiple weights representing:
1. Price (primary)
2. Duration
3. Comfort metrics
4. Layover properties

## Mathematical Formulation

A path through this graph P = {n₁, e₁, n₂, e₂, ..., nₖ} represents a complete trip itinerary.

The optimal path minimizes:
- Cost function f(P) = Σ w(eᵢ) where w is the weight function

## Temporal Dimension

The temporal aspect is critical:
- Nodes exist in time-space, not just physical space
- Edges must respect causality (departure time > arrival time + minimum connection time)
- Time ranges create a discretized continuum of possible nodes

## Constraints

Constraints are represented as:
1. Node filters (restricting valid airports or times)
2. Edge filters (airline restrictions, direct flight requirements)
3. Path constraints (total duration, max segments)

## Example Structure

For a simple round-trip:
```
(OriginSet, DepartDateRange) ----> (DestSet, ArrivalDateRange)
        ^                                   |
        |                                   |
        +-----------------------------------+
        Return flights
```

For multi-city:
```
(Set₁, Range₁) --> (Set₂, Range₂) --> (Set₃, Range₃) --> ... --> (Set₁, Range₄)
```

This graph structure allows for flexible definition of:
- Open-jaw trips (different departure/return cities)
- Multi-city itineraries
- Date flexibility at each point
- Airport alternatives at each point

The search problem then becomes finding the optimal path through this graph subject to the constraints defined by the user.

let's say the user wants to do a europe tour. they have a range of when to leave usa and when to come back. and they also have a set of cities they want to visit in europe, but dont care about ordering. does this graph structure support that?

Absolutely - this is a perfect use case for the graph structure, and reveals why we need a multigraph. Let's break it down:

```
Initial State:
({JFK,BOS}, Mar1-7) ----> ({PAR,AMS,LON}, Mar7-21) ----> ({ROM,BCN}, Mar7-21) ----> ({MAD,LIS}, Mar7-21)
                                                                                            |
                                                                                            v
                         ({JFK,BOS}, Mar21-28) <------------------------------------------ ()
```

The middle nodes (European cities) form a complete subgraph - every city can connect to every other city. The edges between them represent all possible flights between those city pairs within the date ranges.

The optimization problem becomes:
1. Find paths that:
   - Start at any US airport in departure range
   - Visit each European city set exactly once (TSP-like)
   - End at any US airport in return range
2. Minimize total cost while satisfying time constraints

Key Properties:
- Middle nodes are "floating" in time within the overall range
- Order emerges from optimization, not pre-specification
- Multiple edges between nodes represent different flight options/dates
- Solution includes both routing AND timing

This is essentially a constrained TSP (Traveling Salesman Problem) with:
- Time windows
- Multiple possible start/end points
- Cost function that includes both flight prices and preferences
- Required visit sets rather than specific cities

The temporal flexibility at each node is what makes this work - we're not forcing specific dates for intermediate stops, just ensuring the total trip fits within the outer bounds.


hmm that's super interesting. so in this case we would have a different UI component for this sort of TSP subgraph that the user can pick, or is it already modeled?

This reveals a natural hierarchy in the trip types that should be modeled:

1. **Simple Trips** (current model)
   ```
   A -> B -> A
   ```

2. **Open Jaw/Multi-City** (fixed sequence)
   ```
   A -> B -> C -> D
   ```

3. **TSP-style Tours** (unordered visit set)
   ```
   Start -> {Cities to Visit} -> End
   where {Cities} is a set with ordering to be determined
   ```

The UI should reflect this. You could have a "Trip Pattern" selector:
```
[ ] Round Trip
[ ] Multi-City (Fixed)
[x] European Tour (Auto-Route)
    - Origin Airports: [JFK,BOS]
    - Must Visit: [PAR,AMS,LON,ROM,BCN,MAD]
    - Start: [Mar1-7]
    - End: [Mar21-28]
```

The graph structure remains the same, but the solver changes:
- Round Trip: Simple path finding
- Multi-City: Fixed sequence path finding
- Tour: TSP solver with temporal constraints

This suggests the code should have different "Strategy" classes for different trip patterns, even though they all operate on the same underlying graph structure.

The key insight is that the TSP case is just a special type of constraint on valid paths through the graph, not a fundamentally different structure.

for the tour, there are more constraints i can think of. for example there might be 5 acceptable cities but only *need* to visit any 3. how would that fit in?

Ah yes, this introduces the concept of "soft" and "hard" city requirements. Now we have a generalized form:

```
Tour Specification:
- Origin Set: [airports]
- Destination Pool: {
    REQUIRED: [cities that must be visited]
    OPTIONAL: [cities that can be visited]
    MIN_VISITS: n    // e.g., must visit at least 3
    MAX_VISITS: m    // e.g., at most 5 total
}
- Time Constraints: {
    TOTAL_RANGE: [start, end]
    MIN_STAY_PER_CITY: duration
    MAX_STAY_PER_CITY: duration
}
```

This becomes a variant of the Prize-Collecting TSP or Orienteering Problem where:
- Required cities have infinite prize/utility
- Optional cities have finite prize/utility
- Solution must visit all required cities + enough optional ones
- Path must optimize both travel cost and city utility

The solver now needs to:
1. First ensure required cities are included
2. Then optimize selection from optional cities
3. Find optimal ordering and timing that satisfies all constraints

This naturally extends to even more complex constraints:
- Must visit X cities from Group A, Y from Group B
- Must visit either Rome OR Milan
- Must visit Venice before Florence
- etc.

All these can be encoded in the edge and path validity functions of the graph.
