import React, { useState, useEffect } from 'react';

function EdgeConfig({ edge, position, onClose, updateEdgeData }) {
  const [departTimeRange, setDepartTimeRange] = useState('');
  const [direct, setDirect] = useState(true);
  
  useEffect(() => {
    if (edge && edge.data) {
      // Initialize with edge data
      const constraints = edge.data.constraints || {};
      setDepartTimeRange(constraints.departTimeRange || '');
      setDirect(constraints.direct !== undefined ? constraints.direct : true);
    }
  }, [edge]);
  
  const handleSave = () => {
    // Update the edge data
    updateEdgeData(edge.id, {
      constraints: {
        departTimeRange,
        direct,
      },
    });
    
    // Close the configuration
    onClose();
  };
  
  return (
    <div 
      className="edge-config"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <button className="close-button" onClick={onClose}>×</button>
      <h4>Configure Flight Edge</h4>
      
      <div className="form-row">
        <label className="form-label">Departure Time Range</label>
        <input
          type="text"
          className="form-control"
          value={departTimeRange}
          onChange={(e) => setDepartTimeRange(e.target.value)}
          placeholder="e.g. 08:00-12:00"
        />
        <small>Format: HH:MM-HH:MM (24-hour)</small>
      </div>
      
      <div className="form-row">
        <div className="form-check">
          <input
            type="checkbox"
            className="form-check-input"
            id={`direct-${edge.id}`}
            checked={direct}
            onChange={(e) => setDirect(e.target.checked)}
          />
          <label className="form-check-label" htmlFor={`direct-${edge.id}`}>
            Direct Flights Only
          </label>
        </div>
      </div>
      
      <div className="form-row" style={{ marginTop: '15px' }}>
        <button className="btn btn-primary" onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );
}

export default EdgeConfig;