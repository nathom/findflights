import React, { useCallback, useState, useMemo, useEffect } from 'react';
import ReactFlow, {
  addEdge,
  MarkerType,
  Panel,
  useNodesState,
  useEdgesState,
  ConnectionMode,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import AirportNode from './components/nodes/AirportNode';
import EdgeConfig from './components/edges/EdgeConfig';
import { validateGraph, formatCycle } from './utils/graphValidator';

const nodeTypes = {
  airport: AirportNode,
};

const edgeTypes = {
  dateRange: EdgeConfig,
};

const App = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedElements, setSelectedElements] = useState(null);
  const [graphValid, setGraphValid] = useState(true);
  const [validationError, setValidationError] = useState(null);

  const onConnect = useCallback(
    (params) => {
      // Check if an edge already exists between these nodes
      setEdges((eds) => {
        // Check if this connection already exists
        const edgeExists = eds.some(
          (edge) => edge.source === params.source && edge.target === params.target
        );
        
        // If edge already exists, don't add a new one
        if (edgeExists) {
          console.log('Edge already exists between these nodes');
          return eds;
        }
        
        // Create a new edge with unique ID
        const edgeId = `edge-${uuidv4()}`;
        
        // Add the new edge
        return addEdge(
          {
            ...params,
            type: 'dateRange',
            data: { 
              dateRange: { start: new Date().toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] },
              onDateRangeChange: (dateRange) => {
                setEdges(eds => 
                  eds.map(edge => 
                    edge.id === edgeId 
                      ? { ...edge, data: { ...edge.data, dateRange } } 
                      : edge
                  )
                );
              }
            },
            id: edgeId,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 20,
              height: 20,
              color: '#888',
            },
          },
          eds
        );
      });
    },
    [setEdges]
  );

  const addNode = () => {
    const nodeId = `node-${uuidv4()}`;
    
    // Calculate position based on existing nodes to avoid overlap
    let posX = 100 + Math.random() * 200;
    let posY = 100 + Math.random() * 200;
    
    // If there are existing nodes, position the new one with some spacing
    if (nodes.length > 0) {
      // Find the rightmost node
      const rightmostNode = nodes.reduce((max, node) => 
        node.position.x > max.position.x ? node : max, nodes[0]);
      
      // Position to the right of it
      posX = rightmostNode.position.x + 200;
      posY = rightmostNode.position.y;
    }
    
    const newNode = {
      id: nodeId,
      type: 'airport',
      position: { x: posX, y: posY },
      data: { 
        airports: ['SFO'],
        onAirportsChange: (airports) => {
          setNodes(nds => 
            nds.map(node => 
              node.id === nodeId 
                ? { ...node, data: { ...node.data, airports }} 
                : node
            )
          );
        } 
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleSearch = () => {
    const graphData = {
      nodes: nodes.map(node => ({
        id: node.id,
        airports: node.data.airports,
      })),
      edges: edges.map(edge => ({
        source: edge.source,
        target: edge.target,
        dateRange: edge.data?.dateRange || { start: '', end: '' },
      })),
    };
    
    console.log('Graph Structure:', graphData);
  };

  // Handle keyboard shortcuts including Delete key
  React.useEffect(() => {
    const handleKeyDown = (event) => {
      // Handle Delete key
      if (event.key === 'Delete' || event.key === 'Backspace') {
        // If there are selected elements from ReactFlow's selection mechanism
        if (selectedElements) {
          if (selectedElements.edges && selectedElements.edges.length > 0) {
            setEdges((eds) => eds.filter(e => !selectedElements.edges.includes(e.id)));
          }
          if (selectedElements.nodes && selectedElements.nodes.length > 0) {
            // Remove any connected edges first
            setEdges((eds) => eds.filter(e => !selectedElements.nodes.includes(e.source) && !selectedElements.nodes.includes(e.target)));
            // Then remove the nodes
            setNodes((nds) => nds.filter(n => !selectedElements.nodes.includes(n.id)));
          }
        }
      }
    };

    // Add the event listener
    window.addEventListener('keydown', handleKeyDown);
    
    // Clean up
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedElements, setEdges, setNodes]);

  // Handle for selection changes
  const onSelectionChange = (params) => {
    setSelectedElements(params);
  };

  // Edge click handler
  const onEdgeClick = (event, edge) => {
    // The actual editing is handled in the EdgeConfig component
    event.preventDefault();
    event.stopPropagation();
  };

  // Define custom styling for React Flow components
  const customEdgeStyles = useMemo(() => ({
    edge: {
      strokeWidth: 2,
      stroke: '#888',
    },
    edgeLabel: {
      fontSize: 12,
      fill: '#333',
      fontWeight: 500,
    },
  }), []);
  
  // Validate graph whenever nodes or edges change
  useEffect(() => {
    if (edges.length === 0) {
      // No edges, graph is valid
      setGraphValid(true);
      setValidationError(null);
      return;
    }
    
    // Convert the graph to the format expected by the validator
    const flights = edges.map(edge => {
      // Get date range from each edge
      const dateRange = edge.data?.dateRange || { 
        start: new Date().toISOString().split('T')[0], 
        end: new Date().toISOString().split('T')[0] 
      };
      
      // Get source and target airports
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      
      // Use first airport if multiple are defined
      const sourceAirport = sourceNode?.data?.airports?.[0] || 'Unknown';
      const targetAirport = targetNode?.data?.airports?.[0] || 'Unknown';
      
      return {
        id: edge.id,
        source: sourceAirport,
        target: targetAirport,
        // Use start date as departure with 00:00 time
        departure: `${dateRange.start}T00:00:00`,
        // Use end date as arrival with 23:59 time
        arrival: `${dateRange.end}T23:59:00`,
        edgeId: edge.id,
        sourceNodeId: edge.source,
        targetNodeId: edge.target
      };
    });
    
    // Validate the graph
    const result = validateGraph(flights);
    setGraphValid(result.valid);
    
    if (!result.valid) {
      // Format the invalid cycle for display
      setValidationError(formatCycle(result.invalidCycle));
    } else {
      setValidationError(null);
    }
  }, [nodes, edges]);

  return (
    <div className="app-container">
      {!graphValid && (
        <div 
          style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#f44336',
            color: 'white',
            padding: '10px 15px',
            borderRadius: '4px',
            zIndex: 1000,
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            maxWidth: '80%',
            textAlign: 'center'
          }}
        >
          <strong>Invalid Graph:</strong> The graph contains cycles that cannot be unrolled based on dates.<br />
          {validationError && <span>Invalid cycle: {validationError}</span>}
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        style={{ background: '#f8f8f8' }}
        defaultEdgeOptions={{
          type: 'dateRange',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#888',
          },
        }}
        connectionMode={ConnectionMode.Loose}
        defaultViewport={{ zoom: 0.75, x: 0, y: 0 }}
        elementsSelectable={true}
        selectNodesOnDrag={false}
        panOnDrag={true}
        panOnScroll={false}
        zoomOnScroll={true}
        snapToGrid={true}
        snapGrid={[15, 15]}
        minZoom={0.2}
        maxZoom={4}
        deleteKeyCode={['Delete', 'Backspace']}
      >
        <Panel position="top-right">
          <button onClick={addNode}>
            Add Airport Node
          </button>
          <button onClick={handleSearch}>
            Search
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
};

export default App;