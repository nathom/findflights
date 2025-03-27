import React, { useState, memo } from 'react';
import { Handle, Position } from 'reactflow';

const AirportNode = memo(({ id, data }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempAirports, setTempAirports] = useState(data.airports.join(','));
  const [startDate, setStartDate] = useState(data.dateRange.start);
  const [endDate, setEndDate] = useState(data.dateRange.end);
  
  const handleSave = () => {
    // Parse the airports string
    const airports = tempAirports.split(',').map(a => a.trim().toUpperCase()).filter(Boolean);
    
    // Update node data
    data.updateNodeData(id, {
      airports,
      dateRange: {
        start: startDate,
        end: endDate
      }
    });
    
    setIsEditing(false);
  };
  
  const handleCancel = () => {
    setTempAirports(data.airports.join(','));
    setStartDate(data.dateRange.start);
    setEndDate(data.dateRange.end);
    setIsEditing(false);
  };
  
  return (
    <div className="airport-node">
      {/* Handles for connecting edges */}
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      
      <div className="airport-node-header">
        Airport Set
        {!isEditing && (
          <button 
            className="node-menu-button"
            onClick={() => setIsEditing(true)}
          >
            ✏️
          </button>
        )}
      </div>
      
      {isEditing ? (
        <div>
          <div className="form-group">
            <label className="form-label">Airports</label>
            <input
              type="text"
              className="form-control"
              value={tempAirports}
              onChange={(e) => setTempAirports(e.target.value)}
              placeholder="e.g. SFO,OAK,SJC"
            />
            <small>Comma-separated airport codes</small>
          </div>
          
          <div className="form-group">
            <label className="form-label">Date Range Start</label>
            <input
              type="date"
              className="form-control"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Date Range End</label>
            <input
              type="date"
              className="form-control"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          
          <div className="d-flex space-between">
            <button className="btn btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-2">
            <strong>Airports:</strong>
            <div>
              {data.airports.map((airport, i) => (
                <span key={i} className="airport-tag">
                  {airport}
                </span>
              ))}
            </div>
          </div>
          
          <div className="mb-2">
            <strong>Date Range:</strong>
            <div>{data.dateRange.start} to {data.dateRange.end}</div>
          </div>
        </div>
      )}
    </div>
  );
});

export default AirportNode;