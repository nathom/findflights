import React from 'react';

function Sidebar({ airports }) {
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-title">Node Palette</div>
      
      <div className="sidebar-section">
        <p>Drag nodes to the canvas to build your flight search graph:</p>
        
        <div 
          className="dndnode airport-dndnode"
          onDragStart={(e) => onDragStart(e, 'airportNode')}
          draggable
        >
          Airport Node
        </div>
        
        <div 
          className="dndnode tour-dndnode"
          onDragStart={(e) => onDragStart(e, 'tourNode')}
          draggable
        >
          Tour Node
        </div>
      </div>
      
      <div className="sidebar-section">
        <h4>Graph Building Instructions</h4>
        <ol>
          <li>Drag nodes to the canvas</li>
          <li>Connect nodes by dragging from one node's handle to another</li>
          <li>Click on nodes to edit their properties</li>
          <li>Click on edges to configure flight constraints</li>
          <li>Use the Search button to find optimal flights</li>
        </ol>
      </div>
      
      <div className="sidebar-section">
        <h4>Example Patterns</h4>
        <ul>
          <li><strong>Round Trip:</strong> Two airport nodes with bidirectional connections</li>
          <li><strong>Open Jaw:</strong> Three or more airport nodes in sequence</li>
          <li><strong>Flexible Tour:</strong> Connect airport nodes to a tour node</li>
        </ul>
      </div>
      
      <div className="sidebar-section">
        <h4>Available Airports</h4>
        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
          {airports.map((airport) => (
            <div key={airport.code} className="airport-tag">
              {airport.code} - {airport.name}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;