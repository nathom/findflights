import React, { useState } from 'react';
import { format } from 'date-fns';

function AdvancedSearch({ airports, tripTypes, onSearch }) {
  const [selectedTripType, setSelectedTripType] = useState('round_trip');
  const [segments, setSegments] = useState([
    { from: '', to: '', departDate: '', returnDate: '' }
  ]);
  const [requiredCities, setRequiredCities] = useState([]);
  const [optionalCities, setOptionalCities] = useState([]);
  const [globalOptions, setGlobalOptions] = useState({
    top: 5,
    sort: 'price',
    exclude: '',
    departTimeRange: '',
    direct: true,
    minVisits: 0,
    maxVisits: 0,
  });
  
  const handleTripTypeChange = (typeId) => {
    setSelectedTripType(typeId);
    
    // Reset segments based on trip type
    if (typeId === 'round_trip') {
      setSegments([{ from: '', to: '', departDate: '', returnDate: '' }]);
      setRequiredCities([]);
      setOptionalCities([]);
    } else if (typeId === 'one_way') {
      setSegments([{ from: '', to: '', departDate: '' }]);
      setRequiredCities([]);
      setOptionalCities([]);
    } else if (typeId === 'multi_city') {
      setSegments([
        { from: '', to: '', departDate: '' },
        { from: '', to: '', departDate: '' }
      ]);
      setRequiredCities([]);
      setOptionalCities([]);
    } else if (typeId === 'open_jaw') {
      setSegments([
        { from: '', to: '', departDate: '' },
        { from: '', to: '', departDate: '' }
      ]);
      setRequiredCities([]);
      setOptionalCities([]);
    } else if (typeId === 'flexible_tour') {
      setSegments([{ from: '', departDate: '', returnDate: '' }]);
      setRequiredCities([]);
      setOptionalCities([]);
    }
  };
  
  const handleSegmentChange = (index, field, value) => {
    const updatedSegments = [...segments];
    updatedSegments[index][field] = value;
    setSegments(updatedSegments);
  };
  
  const addSegment = () => {
    setSegments([...segments, { from: '', to: '', departDate: '' }]);
  };
  
  const removeSegment = (index) => {
    if (segments.length > 1) {
      const updatedSegments = [...segments];
      updatedSegments.splice(index, 1);
      setSegments(updatedSegments);
    }
  };
  
  const toggleRequiredCity = (city) => {
    if (requiredCities.includes(city)) {
      setRequiredCities(requiredCities.filter(c => c !== city));
    } else {
      setRequiredCities([...requiredCities, city]);
      // Remove from optional if it was there
      if (optionalCities.includes(city)) {
        setOptionalCities(optionalCities.filter(c => c !== city));
      }
    }
  };
  
  const toggleOptionalCity = (city) => {
    if (optionalCities.includes(city)) {
      setOptionalCities(optionalCities.filter(c => c !== city));
    } else {
      setOptionalCities([...optionalCities, city]);
      // Remove from required if it was there
      if (requiredCities.includes(city)) {
        setRequiredCities(requiredCities.filter(c => c !== city));
      }
    }
  };
  
  const handleGlobalOptionChange = (field, value) => {
    setGlobalOptions({
      ...globalOptions,
      [field]: field === 'direct' ? value : value
    });
  };
  
  const formatDate = (date) => {
    if (!date) return '';
    return format(new Date(date), 'M/d/yyyy');
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Prepare search parameters based on selected trip type
    let searchParams = { ...globalOptions };
    
    if (selectedTripType === 'round_trip') {
      searchParams.origin = segments[0].from;
      searchParams.destinations = segments[0].to;
      searchParams.depart = formatDate(segments[0].departDate);
      searchParams.return = formatDate(segments[0].returnDate);
    } 
    else if (selectedTripType === 'one_way') {
      searchParams.origin = segments[0].from;
      searchParams.destinations = segments[0].to;
      searchParams.depart = formatDate(segments[0].departDate);
      // No return date for one-way
    }
    else if (selectedTripType === 'multi_city' || selectedTripType === 'open_jaw') {
      // For now, convert to closest matching format our API accepts
      // First segment is outbound, last is inbound
      searchParams.origin = segments[0].from;
      searchParams.destinations = segments[0].to;
      searchParams.depart = formatDate(segments[0].departDate);
      
      const lastSegment = segments[segments.length - 1];
      searchParams.return = formatDate(lastSegment.departDate);
    }
    else if (selectedTripType === 'flexible_tour') {
      // For advanced tour, use the first segment as bounds
      searchParams.origin = segments[0].from;
      searchParams.destinations = [...requiredCities, ...optionalCities].join(',');
      searchParams.depart = formatDate(segments[0].departDate);
      searchParams.return = formatDate(segments[0].returnDate);
      searchParams.requiredCities = requiredCities.join(',');
      searchParams.optionalCities = optionalCities.join(',');
      searchParams.minVisits = globalOptions.minVisits;
      searchParams.maxVisits = globalOptions.maxVisits;
    }
    
    onSearch(searchParams);
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Trip Type Selector */}
      <div className="form-group mb-3">
        <label className="form-label">Trip Type</label>
        <div className="trip-type-selector">
          {tripTypes.map(type => (
            <div 
              key={type.id}
              className={`trip-type-option ${selectedTripType === type.id ? 'active' : ''}`}
              onClick={() => handleTripTypeChange(type.id)}
            >
              <div>{type.name}</div>
              <small>{type.description}</small>
            </div>
          ))}
        </div>
      </div>
      
      {/* Segments Section */}
      <div className="form-group mb-3">
        <label className="form-label">
          {selectedTripType === 'flexible_tour' ? 'Tour Bounds' : 'Flight Segments'}
        </label>
        
        {segments.map((segment, index) => (
          <div key={index} className="trip-segment">
            {segments.length > 1 && (
              <button 
                type="button"
                className="remove-segment"
                onClick={() => removeSegment(index)}
              >
                ×
              </button>
            )}
            
            <div className="row">
              <div className="col-md-6">
                <div className="form-group">
                  <label className="form-label">From</label>
                  <input 
                    type="text" 
                    className="form-control"
                    value={segment.from}
                    onChange={(e) => handleSegmentChange(index, 'from', e.target.value)}
                    placeholder="e.g. SFO,OAK,SJC"
                    required
                  />
                  <small>Comma-separated airport codes</small>
                </div>
              </div>
              
              {selectedTripType !== 'flexible_tour' && (
                <div className="col-md-6">
                  <div className="form-group">
                    <label className="form-label">To</label>
                    <input 
                      type="text" 
                      className="form-control"
                      value={segment.to}
                      onChange={(e) => handleSegmentChange(index, 'to', e.target.value)}
                      placeholder="e.g. JFK,LGA,EWR"
                      required
                    />
                    <small>Comma-separated airport codes</small>
                  </div>
                </div>
              )}
            </div>
            
            <div className="row mt-2">
              <div className={selectedTripType === 'round_trip' || selectedTripType === 'flexible_tour' ? 'col-md-6' : 'col-md-12'}>
                <div className="form-group">
                  <label className="form-label">
                    {selectedTripType === 'flexible_tour' ? 'Start Date' : 'Departure Date'}
                  </label>
                  <input 
                    type="date" 
                    className="form-control"
                    value={segment.departDate}
                    onChange={(e) => handleSegmentChange(index, 'departDate', e.target.value)}
                    required
                  />
                </div>
              </div>
              
              {(selectedTripType === 'round_trip' || selectedTripType === 'flexible_tour') && (
                <div className="col-md-6">
                  <div className="form-group">
                    <label className="form-label">
                      {selectedTripType === 'flexible_tour' ? 'End Date' : 'Return Date'}
                    </label>
                    <input 
                      type="date" 
                      className="form-control"
                      value={segment.returnDate}
                      onChange={(e) => handleSegmentChange(index, 'returnDate', e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {/* Add Segment Button - Only for multi-city and open-jaw */}
        {(selectedTripType === 'multi_city' || selectedTripType === 'open_jaw') && (
          <button 
            type="button"
            className="add-segment-button"
            onClick={addSegment}
          >
            + Add Another Segment
          </button>
        )}
      </div>
      
      {/* For Flexible Tour - City Selection */}
      {selectedTripType === 'flexible_tour' && (
        <div className="form-group mb-3">
          <label className="form-label">Cities to Visit</label>
          
          <div className="row">
            <div className="col-md-6">
              <div className="form-group">
                <label className="form-label">Required Cities</label>
                <div className="airport-checkbox-list">
                  {airports.map(airport => (
                    <div key={airport.code} className="airport-checkbox">
                      <input 
                        type="checkbox"
                        id={`required-${airport.code}`}
                        checked={requiredCities.includes(airport.code)}
                        onChange={() => toggleRequiredCity(airport.code)}
                      />
                      <label htmlFor={`required-${airport.code}`}>
                        {airport.code} ({airport.name})
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="col-md-6">
              <div className="form-group">
                <label className="form-label">Optional Cities</label>
                <div className="airport-checkbox-list">
                  {airports.map(airport => (
                    <div key={airport.code} className="airport-checkbox">
                      <input 
                        type="checkbox"
                        id={`optional-${airport.code}`}
                        checked={optionalCities.includes(airport.code)}
                        onChange={() => toggleOptionalCity(airport.code)}
                      />
                      <label htmlFor={`optional-${airport.code}`}>
                        {airport.code} ({airport.name})
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          <div className="row mt-3">
            <div className="col-md-6">
              <div className="form-group">
                <label className="form-label">Minimum Cities to Visit</label>
                <input 
                  type="number"
                  className="form-control"
                  value={globalOptions.minVisits}
                  onChange={(e) => handleGlobalOptionChange('minVisits', parseInt(e.target.value) || 0)}
                  min="0"
                />
              </div>
            </div>
            
            <div className="col-md-6">
              <div className="form-group">
                <label className="form-label">Maximum Cities to Visit</label>
                <input 
                  type="number"
                  className="form-control"
                  value={globalOptions.maxVisits}
                  onChange={(e) => handleGlobalOptionChange('maxVisits', parseInt(e.target.value) || 0)}
                  min="0"
                />
              </div>
            </div>
          </div>
          
          {/* Visual Representation of the Tour */}
          <div className="mt-4">
            <label className="form-label">Tour Preview</label>
            <div className="card" style={{ padding: '15px' }}>
              <div className="tsp-node">START: {segments[0]?.from || 'Select Origin'}</div>
              <div className="tsp-edge"></div>
              <div className="tsp-grid">
                {requiredCities.map(city => (
                  <div key={city} className="tsp-node required">{city} (Required)</div>
                ))}
                {optionalCities.map(city => (
                  <div key={city} className="tsp-node">{city} (Optional)</div>
                ))}
              </div>
              <div className="tsp-edge"></div>
              <div className="tsp-node">END: {segments[0]?.from || 'Return to Origin'}</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Global Options Section */}
      <div className="form-group mb-3">
        <label className="form-label">Global Options</label>
        <div className="row">
          <div className="col-md-4">
            <div className="form-group">
              <label className="form-label">Sort By</label>
              <select 
                className="form-control"
                value={globalOptions.sort}
                onChange={(e) => handleGlobalOptionChange('sort', e.target.value)}
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
                value={globalOptions.departTimeRange}
                onChange={(e) => handleGlobalOptionChange('departTimeRange', e.target.value)}
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
                value={globalOptions.top}
                onChange={(e) => handleGlobalOptionChange('top', parseInt(e.target.value) || 5)}
                min="1"
                max="50"
              />
            </div>
          </div>
        </div>
        
        <div className="row mt-2">
          <div className="col-md-6">
            <div className="form-group">
              <label className="form-label">Exclude Airlines</label>
              <input 
                type="text" 
                className="form-control"
                value={globalOptions.exclude}
                onChange={(e) => handleGlobalOptionChange('exclude', e.target.value)}
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
                  id="directFlightsAdvanced"
                  checked={globalOptions.direct}
                  onChange={(e) => handleGlobalOptionChange('direct', e.target.checked)}
                />
                <label className="form-check-label" htmlFor="directFlightsAdvanced">
                  Direct Flights Only
                </label>
              </div>
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

export default AdvancedSearch;