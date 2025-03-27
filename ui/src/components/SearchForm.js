import React, { useState } from 'react';
import { format } from 'date-fns';

function SearchForm({ airports, onSearch }) {
  const [formData, setFormData] = useState({
    origin: '',
    destinations: '',
    depart: '',
    return: '',
    weekend: '',
    top: 5,
    sort: 'price',
    exclude: '',
    departTimeRange: '',
    direct: true,
    workers: 5
  });
  
  const [searchType, setSearchType] = useState('dates'); // 'dates' or 'weekend'
  
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  const handleSearchTypeChange = (type) => {
    setSearchType(type);
    // Clear the other type's fields
    if (type === 'dates') {
      setFormData(prev => ({ ...prev, weekend: '' }));
    } else {
      setFormData(prev => ({ ...prev, depart: '', return: '' }));
    }
  };
  
  const formatDate = (date) => {
    if (!date) return '';
    return format(new Date(date), 'M/d/yyyy');
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Prepare the search params
    const searchParams = { ...formData };
    
    // Format dates from date input to mm/dd format for API
    if (searchType === 'dates') {
      if (formData.depart) {
        searchParams.depart = formatDate(formData.depart);
      }
      if (formData.return) {
        searchParams.return = formatDate(formData.return);
      }
      searchParams.weekend = undefined;
    } else {
      if (formData.weekend) {
        searchParams.weekend = formatDate(formData.weekend);
      }
      searchParams.depart = undefined;
      searchParams.return = undefined;
    }
    
    onSearch(searchParams);
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <div className="row">
        <div className="col-md-6">
          <div className="form-group">
            <label className="form-label">Origin Airports</label>
            <input 
              type="text" 
              className="form-control"
              name="origin"
              value={formData.origin}
              onChange={handleChange}
              placeholder="e.g. SAN,SNA,LAX"
              required
            />
            <small>Comma-separated airport codes</small>
          </div>
        </div>
        
        <div className="col-md-6">
          <div className="form-group">
            <label className="form-label">Destination Airports</label>
            <input 
              type="text" 
              className="form-control"
              name="destinations"
              value={formData.destinations}
              onChange={handleChange}
              placeholder="e.g. SFO,OAK,SJC"
              required
            />
            <small>Comma-separated airport codes</small>
          </div>
        </div>
      </div>
      
      <div className="mb-3">
        <div className="tab-container">
          <div className="tab-buttons">
            <button 
              type="button" 
              className={`tab-button ${searchType === 'dates' ? 'active' : ''}`}
              onClick={() => handleSearchTypeChange('dates')}
            >
              Specific Dates
            </button>
            <button 
              type="button" 
              className={`tab-button ${searchType === 'weekend' ? 'active' : ''}`}
              onClick={() => handleSearchTypeChange('weekend')}
            >
              Weekend Trip
            </button>
          </div>
          
          {searchType === 'dates' ? (
            <div className="row mt-3">
              <div className="col-md-6">
                <div className="form-group">
                  <label className="form-label">Departure Date</label>
                  <input 
                    type="date" 
                    className="form-control"
                    name="depart"
                    value={formData.depart}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
              
              <div className="col-md-6">
                <div className="form-group">
                  <label className="form-label">Return Date</label>
                  <input 
                    type="date" 
                    className="form-control"
                    name="return"
                    value={formData.return}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="form-group mt-3">
              <label className="form-label">Weekend Date</label>
              <input 
                type="date" 
                className="form-control"
                name="weekend"
                value={formData.weekend}
                onChange={handleChange}
                required
              />
              <small>Select any day in the weekend (Fri-Mon)</small>
            </div>
          )}
        </div>
      </div>
      
      <div className="row">
        <div className="col-md-4">
          <div className="form-group">
            <label className="form-label">Sort By</label>
            <select 
              className="form-control"
              name="sort"
              value={formData.sort}
              onChange={handleChange}
            >
              <option value="price">Price</option>
              <option value="total time">Total Time</option>
            </select>
          </div>
        </div>
        
        <div className="col-md-4">
          <div className="form-group">
            <label className="form-label">Departure Time Range</label>
            <input 
              type="text" 
              className="form-control"
              name="departTimeRange"
              value={formData.departTimeRange}
              onChange={handleChange}
              placeholder="e.g. 08:00-12:00"
            />
          </div>
        </div>
        
        <div className="col-md-4">
          <div className="form-group">
            <label className="form-label">Number of Results</label>
            <input 
              type="number" 
              className="form-control"
              name="top"
              value={formData.top}
              onChange={handleChange}
              min="1"
              max="50"
            />
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
              value={formData.exclude}
              onChange={handleChange}
              placeholder="e.g. Spirit,Frontier"
            />
            <small>Comma-separated airline names</small>
          </div>
        </div>
        
        <div className="col-md-6">
          <div className="form-group" style={{ marginTop: '30px' }}>
            <div className="form-check">
              <input 
                type="checkbox" 
                className="form-check-input"
                id="directFlights"
                name="direct"
                checked={formData.direct}
                onChange={handleChange}
              />
              <label className="form-check-label" htmlFor="directFlights">
                Direct Flights Only
              </label>
            </div>
          </div>
        </div>
      </div>
      
      <div className="form-group mt-4">
        <button type="submit" className="btn btn-primary">
          Search Flights
        </button>
      </div>
    </form>
  );
}

export default SearchForm;