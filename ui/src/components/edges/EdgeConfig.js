import React, { useState, useEffect } from 'react';

// Simple edge with label showing date
const EdgeConfig = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
}) => {
  // Calculate the position for the label
  const centerX = (sourceX + targetX) / 2;
  const centerY = (sourceY + targetY) / 2;

  // Edge path
  const path = `M ${sourceX},${sourceY} L ${targetX},${targetY}`;

  // Get today's date if needed
  const today = new Date().toISOString().split('T')[0];
  
  // State for the component
  const [isEditing, setIsEditing] = useState(false);
  const [dateRange, setDateRange] = useState({ 
    start: today, 
    end: today 
  });

  // Initialize from props
  useEffect(() => {
    if (data?.dateRange) {
      setDateRange(data.dateRange);
    }
  }, [data]);

  // Update parent when dates change
  useEffect(() => {
    if (data?.onDateRangeChange) {
      data.onDateRangeChange(dateRange);
    }
  }, [dateRange, data]);

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (e) {
      return dateString;
    }
  };

  // Handle date changes
  const handleChange = (e, field) => {
    const newDateRange = { ...dateRange };
    newDateRange[field] = e.target.value;
    
    // Ensure end date is not before start date
    if (field === 'start' && new Date(newDateRange.start) > new Date(newDateRange.end)) {
      newDateRange.end = newDateRange.start;
    }
    
    setDateRange(newDateRange);
  };

  // Display text for the label
  const getLabelText = () => {
    if (dateRange.start === dateRange.end) {
      return formatDate(dateRange.start);
    } else {
      return `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`;
    }
  };

  return (
    <>
      {/* Main edge path */}
      <path 
        id={id} 
        className="react-flow__edge-path" 
        d={path} 
        markerEnd={markerEnd}
        stroke="#888"
        strokeWidth={2}
      />
      
      {/* Date display/editor */}
      <foreignObject
        width={120}
        height={isEditing ? 100 : 30}
        x={centerX - 60}
        y={centerY - (isEditing ? 50 : 15)}
        className="edgebutton-foreignobject"
        requiredExtensions="http://www.w3.org/1999/xhtml"
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10,
            backgroundColor: 'transparent'
          }}
        >
          {isEditing ? (
            <div 
              style={{ 
                backgroundColor: 'white', 
                padding: '5px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                opacity: 1
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ width: '100%' }}>
                <div style={{ fontSize: '10px', marginBottom: '2px' }}>Start:</div>
                <input 
                  type="date" 
                  value={dateRange.start} 
                  onChange={(e) => handleChange(e, 'start')}
                  style={{ width: '100%', fontSize: '12px' }}
                />
              </div>
              <div style={{ width: '100%' }}>
                <div style={{ fontSize: '10px', marginBottom: '2px' }}>End:</div>
                <input 
                  type="date" 
                  value={dateRange.end} 
                  onChange={(e) => handleChange(e, 'end')}
                  style={{ width: '100%', fontSize: '12px' }}
                />
              </div>
              <button 
                onClick={() => setIsEditing(false)}
                style={{ 
                  width: '100%', 
                  padding: '2px 0',
                  fontSize: '12px',
                  cursor: 'pointer',
                  marginTop: '2px',
                  backgroundColor: '#f0f0f0',
                  border: '1px solid #ccc',
                  borderRadius: '3px'
                }}
              >
                Save
              </button>
            </div>
          ) : (
            <div
              onClick={() => setIsEditing(true)}
              style={{
                backgroundColor: 'white',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer',
                border: '1px solid #ddd',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                opacity: 1
              }}
            >
              {getLabelText()}
            </div>
          )}
        </div>
      </foreignObject>
    </>
  );
};

export default EdgeConfig;