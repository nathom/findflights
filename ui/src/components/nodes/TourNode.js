import React, { useState, memo } from 'react';
import { Handle, Position } from 'reactflow';

const TourNode = memo(({ id, data }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [startDate, setStartDate] = useState(data.dateRange.start);
  const [endDate, setEndDate] = useState(data.dateRange.end);
  const [minVisits, setMinVisits] = useState(data.minVisits);
  const [maxVisits, setMaxVisits] = useState(data.maxVisits);
  const [selectedAirport, setSelectedAirport] = useState('');
  const [airportType, setAirportType] = useState('required');
  
  const addAirport = () => {
    if (!selectedAirport) return;
    
    if (airportType === 'required') {
      if (!data.requiredCities.includes(selectedAirport)) {
        const newRequired = [...data.requiredCities, selectedAirport];
        data.updateNodeData(id, { requiredCities: newRequired });
      }
    } else {
      if (!data.optionalCities.includes(selectedAirport)) {
        const newOptional = [...data.optionalCities, selectedAirport];
        data.updateNodeData(id, { optionalCities: newOptional });
      }
    }
    
    setSelectedAirport('');
  };
  
  const removeAirport = (airport, type) => {
    if (type === 'required') {
      const newRequired = data.requiredCities.filter(a => a !== airport);
      data.updateNodeData(id, { requiredCities: newRequired });
    } else {
      const newOptional = data.optionalCities.filter(a => a !== airport);
      data.updateNodeData(id, { optionalCities: newOptional });
    }
  };
  
  const handleSave = () => {
    // Update node data
    data.updateNodeData(id, {
      dateRange: {
        start: startDate,
        end: endDate
      },
      minVisits: parseInt(minVisits) || 0,
      maxVisits: parseInt(maxVisits) || 0
    });
    
    setIsEditing(false);
  };
  
  const handleCancel = () => {
    setStartDate(data.dateRange.start);
    setEndDate(data.dateRange.end);
    setMinVisits(data.minVisits);
    setMaxVisits(data.maxVisits);
    setIsEditing(false);
  };
  
  return (
    <div className="tour-node">
      {/* Handles for connecting edges */}
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      
      <div className="tour-node-header">
        Tour Group
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
            <div className="form-group" style={{ width: '48%' }}>
              <label className="form-label">Min Visits</label>
              <input
                type="number"
                className="form-control"
                value={minVisits}
                onChange={(e) => setMinVisits(e.target.value)}
                min="0"
              />
            </div>
            
            <div className="form-group" style={{ width: '48%' }}>
              <label className="form-label">Max Visits</label>
              <input
                type="number"
                className="form-control"
                value={maxVisits}
                onChange={(e) => setMaxVisits(e.target.value)}
                min="0"
              />
            </div>
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
            <strong>Date Range:</strong>
            <div>{data.dateRange.start} to {data.dateRange.end}</div>
          </div>
          
          <div className="mb-2">
            <strong>Required Cities ({data.requiredCities.length}):</strong>
            <div>
              {data.requiredCities.map((airport, i) => (
                <span key={i} className="airport-tag required-airport">
                  {airport}
                  <span 
                    className="airport-tag-close"
                    onClick={() => removeAirport(airport, 'required')}
                  >
                    ×
                  </span>
                </span>
              ))}
            </div>
          </div>
          
          <div className="mb-2">
            <strong>Optional Cities ({data.optionalCities.length}):</strong>
            <div>
              {data.optionalCities.map((airport, i) => (
                <span key={i} className="airport-tag optional-airport">
                  {airport}
                  <span 
                    className="airport-tag-close"
                    onClick={() => removeAirport(airport, 'optional')}
                  >
                    ×
                  </span>
                </span>
              ))}
            </div>
          </div>
          
          <div className="mb-2">
            <strong>Visits:</strong>
            <div>
              {data.minVisits > 0 && `Min: ${data.minVisits}`}
              {data.maxVisits > 0 && ` Max: ${data.maxVisits}`}
              {data.minVisits === 0 && data.maxVisits === 0 && 'No constraints'}
            </div>
          </div>
          
          <div className="d-flex space-between mb-2">
            <select 
              className="form-select"
              value={selectedAirport}
              onChange={(e) => setSelectedAirport(e.target.value)}
              style={{ flex: 1 }}
            >
              <option value="">Select an airport</option>
              {data.allAirports && data.allAirports.map(airport => (
                <option key={airport.code} value={airport.code}>
                  {airport.code} - {airport.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="d-flex space-between mb-2">
            <select 
              className="form-select"
              value={airportType}
              onChange={(e) => setAirportType(e.target.value)}
              style={{ width: '48%' }}
            >
              <option value="required">Required</option>
              <option value="optional">Optional</option>
            </select>
            
            <button 
              className="btn btn-secondary" 
              onClick={addAirport}
              disabled={!selectedAirport}
              style={{ width: '48%' }}
            >
              Add Airport
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default TourNode;