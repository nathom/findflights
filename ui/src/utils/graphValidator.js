/**
 * Graph validation for the flight planner
 * Handles checking if a graph can be "unrolled" into a DAG based on date ordering
 */

/**
 * Find cycles in the flight graph
 * 
 * @param {Array} flights Array of flight objects with source, target, departure, arrival fields
 * @returns {Array} Array of cycles found in the graph
 */
export function findCycles(flights) {
  // Build an index: source -> list of flights
  const flightsBySource = {};
  flights.forEach(flight => {
    if (!flightsBySource[flight.source]) {
      flightsBySource[flight.source] = [];
    }
    flightsBySource[flight.source].push(flight);
  });

  const cycles = [];
  
  // Helper function for DFS
  function dfs(node, start, path, visited) {
    // If we loop back to start (and path is non-empty) record a cycle
    if (visited.has(node)) {
      if (node === start && path.length > 0) {
        cycles.push([...path]);
      }
      return;
    }
    
    // Add current node to visited
    const newVisited = new Set(visited);
    newVisited.add(node);
    
    // Continue DFS for each outgoing flight
    const outgoingFlights = flightsBySource[node] || [];
    for (const flight of outgoingFlights) {
      dfs(flight.target, start, [...path, flight], newVisited);
    }
  }
  
  // Run DFS from every node
  const nodes = new Set();
  flights.forEach(flight => {
    nodes.add(flight.source);
    nodes.add(flight.target);
  });
  
  nodes.forEach(node => {
    dfs(node, node, [], new Set());
  });
  
  return cycles;
}

/**
 * Check if a cycle respects time ordering
 * 
 * @param {Array} cycle Array of flights forming a cycle
 * @returns {boolean} True if time-respecting, false otherwise
 */
export function isTimeRespecting(cycle) {
  if (!cycle || cycle.length === 0) {
    return true;
  }
  
  let currentArrival = null;
  
  for (const flight of cycle) {
    // Convert date strings to timestamps for comparison
    const departure = new Date(flight.departure).getTime();
    
    // If departure is not after previous arrival, cycle is not time-respecting
    if (currentArrival !== null && departure <= currentArrival) {
      return false;
    }
    
    currentArrival = new Date(flight.arrival).getTime();
  }
  
  return true;
}

/**
 * Validate if a graph can be unrolled into a DAG
 * 
 * @param {Array} flights Array of flight objects
 * @returns {Object} Result with valid flag and invalid cycle if found
 */
export function validateGraph(flights) {
  // Convert date strings to date objects for the flight objects
  const processedFlights = flights.map(flight => ({
    ...flight,
    departure: new Date(flight.departure).getTime(),
    arrival: new Date(flight.arrival).getTime()
  }));
  
  // Find all cycles and check if they're time-respecting
  const cycles = findCycles(processedFlights);
  
  for (const cycle of cycles) {
    if (!isTimeRespecting(cycle)) {
      return { 
        valid: false, 
        invalidCycle: cycle 
      };
    }
  }
  
  return { 
    valid: true,
    cycles
  };
}

/**
 * Format a cycle for display
 * 
 * @param {Array} cycle A cycle of flights
 * @returns {string} Formatted string representation
 */
export function formatCycle(cycle) {
  if (!cycle || cycle.length === 0) {
    return "Empty cycle";
  }
  
  return cycle.map((flight, index) => {
    const departureDate = new Date(flight.departure);
    const arrivalDate = new Date(flight.arrival);
    const formattedDeparture = departureDate.toLocaleDateString();
    const formattedArrival = arrivalDate.toLocaleDateString();
    
    return `${flight.source} (${formattedDeparture}) → ${flight.target} (${formattedArrival})`;
  }).join(" → ");
}