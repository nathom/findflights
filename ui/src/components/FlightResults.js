import React, { useState } from 'react';

function FlightResults({ results, total }) {
  const [viewMode, setViewMode] = useState('table');
  
  // Check if results is an array
  if (!Array.isArray(results) || results.length === 0) {
    return (
      <div className="card">
        <p>No flights found matching your criteria.</p>
      </div>
    );
  }
  
  // Determine if we're showing round-trip or one-way flights
  const isRoundTrip = results[0].hasOwnProperty('out_src') && results[0].hasOwnProperty('in_src');
  
  // For one-way flights
  if (!isRoundTrip) {
    return (
      <div className="card">
        <div className="d-flex space-between align-center mb-3">
          <h3>Flight Results <small>({results.length} of {total} total)</small></h3>
          
          <div className="tab-buttons">
            <button 
              className={`tab-button ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              Table View
            </button>
            <button 
              className={`tab-button ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
            >
              Card View
            </button>
          </div>
        </div>
        
        {viewMode === 'table' ? (
          <table className="search-results-table">
            <thead>
              <tr>
                <th>Route</th>
                <th>Date</th>
                <th>Flight</th>
                <th>Airline</th>
                <th>Price</th>
                <th>Direct</th>
              </tr>
            </thead>
            <tbody>
              {results.map((flight, index) => (
                <tr key={index}>
                  <td>{flight.from} → {flight.to}</td>
                  <td>{flight.depart}</td>
                  <td>
                    <div>{flight.dep_time} - {flight.arr_time}</div>
                    <div className="flight-duration">{flight.duration}</div>
                  </td>
                  <td>{flight.airline}</td>
                  <td className="flight-price">${(flight.cost / 100).toFixed(2)}</td>
                  <td>{flight.stops && flight.stops.toLowerCase().includes('nonstop') ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="row">
            {results.map((flight, index) => (
              <div key={index} className="col-md-4 mb-3">
                <div className="card" style={{ height: '100%' }}>
                  <div className="airport-node-header">
                    {flight.from} → {flight.to}
                  </div>
                  <div style={{ padding: '10px' }}>
                    <div><strong>Date:</strong> {flight.depart}</div>
                    <div><strong>Time:</strong> {flight.dep_time} - {flight.arr_time}</div>
                    <div><strong>Duration:</strong> {flight.duration}</div>
                    <div><strong>Airline:</strong> {flight.airline}</div>
                    <div><strong>Price:</strong> <span className="flight-price">${(flight.cost / 100).toFixed(2)}</span></div>
                    <div><strong>Direct:</strong> {flight.stops && flight.stops.toLowerCase().includes('nonstop') ? 'Yes' : 'No'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  
  // For round-trip flights
  return (
    <div className="card">
      <div className="d-flex space-between align-center mb-3">
        <h3>Round-trip Results <small>({results.length} of {total} total)</small></h3>
        
        <div className="tab-buttons">
          <button 
            className={`tab-button ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
          >
            Table View
          </button>
          <button 
            className={`tab-button ${viewMode === 'cards' ? 'active' : ''}`}
            onClick={() => setViewMode('cards')}
          >
            Card View
          </button>
        </div>
      </div>
      
      {viewMode === 'table' ? (
        <table className="search-results-table">
          <thead>
            <tr>
              <th>Routes</th>
              <th>Outbound</th>
              <th>Return</th>
              <th>Airlines</th>
              <th>Stay</th>
              <th>Total Price</th>
              <th>Direct</th>
            </tr>
          </thead>
          <tbody>
            {results.map((trip, index) => (
              <tr key={index}>
                <td>
                  <div>{trip.out_src} → {trip.out_dest}</div>
                  <div>{trip.in_src} → {trip.in_dest}</div>
                </td>
                <td>
                  <div><strong>{trip.out_date}</strong></div>
                  <div>{trip.out_dep_time} - {trip.out_arr_time}</div>
                  <div className="flight-duration">{trip.out_duration}</div>
                </td>
                <td>
                  <div><strong>{trip.in_date}</strong></div>
                  <div>{trip.in_dep_time} - {trip.in_arr_time}</div>
                  <div className="flight-duration">{trip.in_duration}</div>
                </td>
                <td>
                  <div>{trip.out_airline}</div>
                  <div>{trip.in_airline}</div>
                </td>
                <td>{trip.stay_dur ? `${Math.floor(trip.stay_dur / 1440)}d ${Math.floor((trip.stay_dur % 1440) / 60)}h` : 'N/A'}</td>
                <td className="flight-price">
                  <div>${(trip.total_cost / 100).toFixed(2)}</div>
                  <small>${(trip.out_cost / 100).toFixed(2)} / ${(trip.in_cost / 100).toFixed(2)}</small>
                </td>
                <td>
                  {trip.out_stops && trip.in_stops && 
                  trip.out_stops.toLowerCase().includes('nonstop') && 
                  trip.in_stops.toLowerCase().includes('nonstop') ? 'Yes' : 'No'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="row">
          {results.map((trip, index) => (
            <div key={index} className="col-md-6 mb-3">
              <div className="card" style={{ height: '100%' }}>
                <div className="d-flex space-between">
                  <div style={{ width: '48%' }}>
                    <div className="airport-node-header">
                      Outbound: {trip.out_src} → {trip.out_dest}
                    </div>
                    <div style={{ padding: '10px' }}>
                      <div><strong>Date:</strong> {trip.out_date}</div>
                      <div><strong>Time:</strong> {trip.out_dep_time} - {trip.out_arr_time}</div>
                      <div><strong>Duration:</strong> {trip.out_duration}</div>
                      <div><strong>Airline:</strong> {trip.out_airline}</div>
                      <div><strong>Price:</strong> <span className="flight-price">${(trip.out_cost / 100).toFixed(2)}</span></div>
                      <div><strong>Direct:</strong> {trip.out_stops && trip.out_stops.toLowerCase().includes('nonstop') ? 'Yes' : 'No'}</div>
                    </div>
                  </div>
                  
                  <div style={{ width: '48%' }}>
                    <div className="airport-node-header">
                      Return: {trip.in_src} → {trip.in_dest}
                    </div>
                    <div style={{ padding: '10px' }}>
                      <div><strong>Date:</strong> {trip.in_date}</div>
                      <div><strong>Time:</strong> {trip.in_dep_time} - {trip.in_arr_time}</div>
                      <div><strong>Duration:</strong> {trip.in_duration}</div>
                      <div><strong>Airline:</strong> {trip.in_airline}</div>
                      <div><strong>Price:</strong> <span className="flight-price">${(trip.in_cost / 100).toFixed(2)}</span></div>
                      <div><strong>Direct:</strong> {trip.in_stops && trip.in_stops.toLowerCase().includes('nonstop') ? 'Yes' : 'No'}</div>
                    </div>
                  </div>
                </div>
                
                <div style={{ padding: '10px', borderTop: '1px solid #eee', marginTop: '10px' }}>
                  <div className="d-flex space-between">
                    <div><strong>Stay Duration:</strong> {trip.stay_dur ? `${Math.floor(trip.stay_dur / 1440)}d ${Math.floor((trip.stay_dur % 1440) / 60)}h` : 'N/A'}</div>
                    <div><strong>Total Price:</strong> <span className="flight-price">${(trip.total_cost / 100).toFixed(2)}</span></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FlightResults;