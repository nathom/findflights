import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

import Header from './components/Header';
import FlightResults from './components/FlightResults';
import Sidebar from './components/Sidebar';
import GlobalConstraints from './components/GlobalConstraints';
import AirportNode from './components/nodes/AirportNode';
import TourNode from './components/nodes/TourNode';
import EdgeLabel from './components/edges/EdgeLabel';
import EdgeConfig from './components/edges/EdgeConfig';
import { fetchAirports, searchFlights } from './api';

// Node types for the graph
const nodeTypes = {
  airportNode: AirportNode,
  tourNode: TourNode,
};

// Edge types for the graph
const edgeTypes = {
  flightEdge: EdgeLabel,
};

// Initial positions for new nodes
const initialNodePosition = { x: 250, y: 100 };

function App() {
  // State for graph elements
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // State for airports data
  const [airports, setAirports] = useState([]);
  
  // State for global constraints
  const [globalConstraints, setGlobalConstraints] = useState({
    top: 5,
    sort: 'price',
    exclude: '',
    departTimeRange: '',
    direct: true,
    workers: 5,
  });
  
  // State for edge configuration
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [edgeConfigPosition, setEdgeConfigPosition] = useState({ x: 0, y: 0 });
  
  // State for search results
  const [searchResults, setSearchResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Load airports on component mount
  useEffect(() => {
    async function loadAirports() {
      try {
        const airportsData = await fetchAirports();
        setAirports(airportsData);
      } catch (err) {
        setError('Failed to load airports. Please refresh the page.');
        console.error(err);
      }
    }
    
    loadAirports();
  }, []);
  
  // Handle adding a new node to the graph
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);
  
  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      
      const nodeType = event.dataTransfer.getData('application/reactflow');
      
      if (typeof nodeType === 'undefined' || !nodeType) {
        return;
      }
      
      // Get the position from the drop event
      const position = {
        x: event.clientX - initialNodePosition.x,
        y: event.clientY - initialNodePosition.y,
      };
      
      // Create a new node based on the type
      let newNode = {
        id: `${nodeType}-${Date.now()}`,
        position,
        data: { label: nodeType === 'airportNode' ? 'Airport Node' : 'Tour Node' },
      };
      
      if (nodeType === 'airportNode') {
        newNode.type = 'airportNode';
        newNode.data = {
          airports: airports.slice(0, 5).map(a => a.code),
          dateRange: {
            start: new Date().toISOString().split('T')[0],
            end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          },
          updateNodeData: updateNodeData,
        };
      } else if (nodeType === 'tourNode') {
        newNode.type = 'tourNode';
        newNode.data = {
          requiredCities: [],
          optionalCities: [],
          minVisits: 0,
          maxVisits: 0,
          dateRange: {
            start: new Date().toISOString().split('T')[0],
            end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          },
          updateNodeData: updateNodeData,
          allAirports: airports,
        };
      }
      
      setNodes((nds) => nds.concat(newNode));
    },
    [airports, setNodes]
  );
  
  // Update node data when it changes
  const updateNodeData = (nodeId, newData) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ...newData,
              updateNodeData, // Keep the update function
              allAirports: airports, // Keep the airports list for tour nodes
            },
          };
        }
        return node;
      })
    );
  };
  
  // Connect nodes with edges
  const onConnect = useCallback(
    (params) => {
      // Create a new edge with a unique ID
      const newEdge = {
        ...params,
        id: `edge-${Date.now()}`,
        type: 'flightEdge',
        animated: true,
        label: 'Flight',
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
        data: {
          constraints: {
            departTimeRange: '',
            direct: true,
          },
        },
      };
      
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );
  
  // Handle edge click for configuration
  const onEdgeClick = useCallback((event, edge) => {
    // Set the edge configuration position
    setEdgeConfigPosition({
      x: event.clientX,
      y: event.clientY,
    });
    
    // Set the selected edge
    setSelectedEdge(edge);
  }, []);
  
  // Update edge data
  const updateEdgeData = (edgeId, newData) => {
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.id === edgeId) {
          return {
            ...edge,
            data: {
              ...edge.data,
              ...newData,
            },
          };
        }
        return edge;
      })
    );
  };
  
  // Close edge configuration
  const closeEdgeConfig = () => {
    setSelectedEdge(null);
  };
  
  // Handle search button click
  const handleSearch = async () => {
    setIsLoading(true);
    setError(null);
    setSearchResults(null);
    
    try {
      // Build the search graph structure
      const graph = buildSearchGraph();
      
      // Call the API
      const results = await searchFlights({
        ...graph,
        ...globalConstraints,
      });
      
      setSearchResults(results);
    } catch (err) {
      setError(err.message || 'An error occurred during search');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Build the search graph structure from nodes and edges
  const buildSearchGraph = () => {
    const graph = {
      nodes: nodes.map(node => ({
        id: node.id,
        type: node.type,
        data: {
          ...node.data,
          updateNodeData: undefined, // Remove the function
          allAirports: undefined, // Remove the airports list
        },
      })),
      edges: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        data: edge.data,
      })),
    };
    
    // For simple round trip structure
    const airportNodes = nodes.filter(node => node.type === 'airportNode');
    const tourNodes = nodes.filter(node => node.type === 'tourNode');
    
    if (airportNodes.length === 2 && tourNodes.length === 0) {
      // This is likely a simple round trip
      const sourceNode = airportNodes[0];
      const targetNode = airportNodes[1];
      
      // Check if there are edges connecting them
      const outboundEdge = edges.find(e => e.source === sourceNode.id && e.target === targetNode.id);
      const inboundEdge = edges.find(e => e.source === targetNode.id && e.target === sourceNode.id);
      
      if (outboundEdge && inboundEdge) {
        // We have a round trip
        return {
          type: 'round_trip',
          origin: sourceNode.data.airports.join(','),
          destinations: targetNode.data.airports.join(','),
          depart: sourceNode.data.dateRange.start,
          return: targetNode.data.dateRange.start,
          departTimeRange: outboundEdge.data?.constraints?.departTimeRange || '',
          direct: outboundEdge.data?.constraints?.direct || true,
        };
      }
    }
    
    // If we have tour nodes
    if (tourNodes.length > 0) {
      const tourNode = tourNodes[0]; // Use the first tour node
      const connectedAirportNodes = airportNodes.filter(node => 
        edges.some(e => e.source === node.id && e.target === tourNode.id) ||
        edges.some(e => e.source === tourNode.id && e.target === node.id)
      );
      
      if (connectedAirportNodes.length > 0) {
        // This is a tour with connected airport nodes
        return {
          type: 'flexible_tour',
          origin: connectedAirportNodes[0].data.airports.join(','),
          destinations: [...tourNode.data.requiredCities, ...tourNode.data.optionalCities].join(','),
          depart: connectedAirportNodes[0].data.dateRange.start,
          return: connectedAirportNodes[0].data.dateRange.end,
          requiredCities: tourNode.data.requiredCities.join(','),
          optionalCities: tourNode.data.optionalCities.join(','),
          minVisits: tourNode.data.minVisits,
          maxVisits: tourNode.data.maxVisits,
        };
      }
    }
    
    // Default - create a search graph that contains all nodes and edges
    return {
      type: 'custom',
      graphData: graph,
    };
  };
  
  return (
    <div className="app">
      <Header />
      
      <div className="d-flex">
        <Sidebar 
          airports={airports}
        />
        
        <div className="content-with-sidebar">
          <GlobalConstraints 
            constraints={globalConstraints}
            setConstraints={setGlobalConstraints}
          />
          
          <div className="search-controls">
            <h3>Flight Search Graph</h3>
            <button 
              className="btn btn-primary"
              onClick={handleSearch}
              disabled={isLoading || nodes.length === 0}
            >
              {isLoading ? 'Searching...' : 'Search Flights'}
            </button>
          </div>
          
          {error && (
            <div className="card" style={{ backgroundColor: '#f8d7da', borderColor: '#f5c6cb' }}>
              <p style={{ color: '#721c24' }}>{error}</p>
            </div>
          )}
          
          <div className="graph-container">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onEdgeClick={onEdgeClick}
              onDragOver={onDragOver}
              onDrop={onDrop}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
            >
              <Background />
              <Controls />
            </ReactFlow>
            
            {selectedEdge && (
              <EdgeConfig
                edge={selectedEdge}
                position={edgeConfigPosition}
                onClose={closeEdgeConfig}
                updateEdgeData={updateEdgeData}
              />
            )}
          </div>
          
          {isLoading && (
            <div className="search-loader">
              <p>Searching for flights... This might take a moment.</p>
            </div>
          )}
          
          {searchResults && !isLoading && (
            <div className="search-results">
              <FlightResults 
                results={searchResults.results}
                total={searchResults.total}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;