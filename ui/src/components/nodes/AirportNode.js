import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';

const AirportNode = ({ data, isConnectable }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [airports, setAirports] = useState(data.airports || ['SFO']);
  const [newAirport, setNewAirport] = useState('');
  
  // Update parent component when airports change
  useEffect(() => {
    if (data.onAirportsChange) {
      data.onAirportsChange(airports);
    }
  }, [airports, data]);

  const handleClick = () => {
    setIsEditing(true);
  };

  const handleAddAirport = () => {
    if (newAirport.trim()) {
      setAirports([...airports, newAirport.trim().toUpperCase()]);
      setNewAirport('');
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    // Keep at least one airport
    if (airports.length === 0) {
      setAirports(['SFO']);
    }
  };

  const handleRemoveAirport = (index) => {
    const newAirports = [...airports];
    newAirports.splice(index, 1);
    setAirports(newAirports);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleAddAirport();
    }
  };

  return (
    <div style={{ 
      padding: '10px',
      borderRadius: '10px',
      background: 'white',
      border: '1px solid #ddd',
      minWidth: '100px',
      minHeight: '60px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      position: 'relative'
    }}>
      {/* Top handle */}
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        isConnectable={isConnectable}
        style={{ 
          opacity: 0,
          width: '60%',
          height: '14px',
          top: '-7px',
          borderRadius: '4px',
          transform: 'none',
          left: '20%',
          zIndex: 1
        }}
      />
      
      {/* Right handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        isConnectable={isConnectable}
        style={{ 
          opacity: 0,
          width: '14px',
          height: '60%',
          right: '-7px',
          borderRadius: '4px',
          transform: 'none',
          top: '20%',
          zIndex: 1
        }}
      />
      
      {/* Bottom handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        isConnectable={isConnectable}
        style={{ 
          opacity: 0,
          width: '60%',
          height: '14px',
          bottom: '-7px',
          borderRadius: '4px',
          transform: 'none',
          left: '20%',
          zIndex: 1
        }}
      />
      
      {/* Left handle */}
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        isConnectable={isConnectable}
        style={{ 
          opacity: 0,
          width: '14px',
          height: '60%',
          left: '-7px',
          borderRadius: '4px',
          transform: 'none',
          top: '20%',
          zIndex: 1
        }}
      />
      
      {isEditing ? (
        <div style={{ padding: '5px', width: '100%' }}>
          {airports.map((airport, index) => (
            <div key={index} style={{ margin: '5px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ marginRight: '5px' }}>{airport}</span>
              <button 
                onClick={() => handleRemoveAirport(index)}
                style={{ 
                  border: 'none', 
                  background: '#f44336', 
                  color: 'white',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  fontSize: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: 0
                }}
              >
                ×
              </button>
            </div>
          ))}
          <div style={{ marginTop: '5px', display: 'flex' }}>
            <input
              type="text"
              value={newAirport}
              onChange={(e) => setNewAirport(e.target.value)}
              placeholder="Airport"
              style={{ width: '60px', marginRight: '5px' }}
              onKeyPress={handleKeyPress}
            />
            <button onClick={handleAddAirport} style={{ fontSize: '12px' }}>Add</button>
          </div>
          <button onClick={handleBlur} style={{ marginTop: '5px', fontSize: '12px', width: '100%' }}>Done</button>
        </div>
      ) : (
        <div onClick={handleClick} style={{ cursor: 'pointer', textAlign: 'center' }}>
          {airports.map((airport, i) => (
            <div key={i}>{airport}</div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AirportNode;