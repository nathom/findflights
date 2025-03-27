import React, { useState } from 'react';

function GlobalConstraints({ constraints, setConstraints }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConstraints({
      ...constraints,
      [name]: type === 'checkbox' ? checked : value
    });
  };
  
  return (
    <div className="constraints-panel">
      <div className="d-flex space-between align-center" onClick={() => setIsExpanded(!isExpanded)} style={{ cursor: 'pointer' }}>
        <h3 style={{ margin: 0 }}>Global Search Constraints</h3>
        <span>{isExpanded ? '▲' : '▼'}</span>
      </div>
      
      {isExpanded && (
        <div className="mt-3">
          <div className="row">
            <div className="col-md-4">
              <div className="form-group">
                <label className="form-label">Sort Results By</label>
                <select 
                  className="form-control"
                  name="sort"
                  value={constraints.sort}
                  onChange={handleChange}
                >
                  <option value="price">Price</option>
                  <option value="total time">Total Trip Time</option>
                </select>
              </div>
            </div>
            
            <div className="col-md-4">
              <div className="form-group">
                <label className="form-label">Number of Results</label>
                <input 
                  type="number" 
                  className="form-control"
                  name="top"
                  value={constraints.top}
                  onChange={handleChange}
                  min="1"
                  max="50"
                />
              </div>
            </div>
            
            <div className="col-md-4">
              <div className="form-group">
                <label className="form-label">Default Departure Time Range</label>
                <input 
                  type="text" 
                  className="form-control"
                  name="departTimeRange"
                  value={constraints.departTimeRange}
                  onChange={handleChange}
                  placeholder="e.g. 08:00-12:00"
                />
                <small>This can be overridden by edge settings</small>
              </div>
            </div>
          </div>
          
          <div className="row">
            <div className="col-md-6">
              <div className="form-group">
                <label className="form-label">Exclude Airlines</label>
                <input 
                  type="text" 
                  className="form-control"
                  name="exclude"
                  value={constraints.exclude}
                  onChange={handleChange}
                  placeholder="e.g. Spirit,Frontier"
                />
                <small>Comma-separated airline names</small>
              </div>
            </div>
            
            <div className="col-md-6">
              <div className="form-group" style={{ marginTop: '2rem' }}>
                <div className="form-check">
                  <input 
                    type="checkbox" 
                    className="form-check-input"
                    id="directFlights"
                    name="direct"
                    checked={constraints.direct}
                    onChange={handleChange}
                  />
                  <label className="form-check-label" htmlFor="directFlights">
                    Direct Flights Only (Default)
                  </label>
                  <small className="d-block">This can be overridden by edge settings</small>
                </div>
              </div>
            </div>
          </div>
          
          <div className="row">
            <div className="col-md-3">
              <div className="form-group">
                <label className="form-label">Parallel Workers</label>
                <input 
                  type="number" 
                  className="form-control"
                  name="workers"
                  value={constraints.workers}
                  onChange={handleChange}
                  min="1"
                  max="10"
                />
                <small>Higher = faster, but may cause timeouts</small>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GlobalConstraints;