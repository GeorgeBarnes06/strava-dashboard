import React, { useEffect, useState } from 'react';
import './App.css';
import axios from 'axios'
import polyline from '@mapbox/polyline'

function App() {
  const [activities, setActivites] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreActivities, setHasMoreActivities] = useState(true);
  const [selectedDistance, setSelectedDistance] = useState(null);
  const [customDistance, setCustomDistance] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  
  const clientID = process.env.REACT_APP_STRAVA_CLIENT_ID;
  const clientSecret = process.env.REACT_APP_STRAVA_CLIENT_SECRET;
  const refreshToken = process.env.REACT_APP_REFRESH_TOKEN;
  const activities_link = `https://www.strava.com/api/v3/athlete/activities`

  // Distance presets in kilometers
  const distancePresets = [
    { label: '5K', distance: 5, tolerance: 0.5 },
    { label: '10K', distance: 10, tolerance: 1 },
    { label: '15K', distance: 15, tolerance: 1.5 },
    { label: 'Half Marathon', distance: 21.1, tolerance: 2 },
    { label: 'Marathon', distance: 42.2, tolerance: 3 }
  ];

  const handleStravaLogin = () => {
    setError(null);
    const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${clientID}&response_type=code&redirect_uri=http://localhost:3000/&approval_prompt=force&scope=read,activity:read_all`;
    window.location.href = stravaAuthUrl;
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');
    
    if (authCode && !isLoggedIn) {
      exchangeCodeForToken(authCode);
    }
  }, [isLoggedIn]);

  const exchangeCodeForToken = async (code) => {
    setIsLoading(true);
    try {
      const response = await axios.post('https://www.strava.com/oauth/token', {
        client_id: clientID,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code'
      });
      
      setAccessToken(response.data.access_token);
      setIsLoggedIn(true);
      console.log('Successfully authenticated with Strava!', response.data);
      
      window.history.replaceState({}, document.title, "/");
      await fetchActivities(response.data.access_token, 1, true);
      
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      setError('Failed to authenticate with Strava. Please try again.');
      setIsLoggedIn(false);
      setAccessToken(null);
    }
    setIsLoading(false);
  };

  const fetchActivities = async (token = accessToken, page = 1, resetActivities = false) => {
    if (!token) return;
    
    setIsLoading(true);
    try {
      const perPage = 200;
      const response = await axios.get(`${activities_link}?access_token=${token}&page=${page}&per_page=${perPage}`);
      console.log('Activities:', response.data);
      
      const newActivities = response.data;
      const runActivities = newActivities.filter(activity => activity.type === 'Run');
      
      if (resetActivities || page === 1) {
        setActivites(runActivities);
      } else {
        setActivites(prev => [...prev, ...runActivities]);
      }
      
      setHasMoreActivities(newActivities.length === perPage);
      setCurrentPage(page);
      
    } catch (error) {
      console.error('Error fetching activities:', error);
      setError('Failed to load activities. Please try logging in again.');
      setIsLoggedIn(false);
      setAccessToken(null);
      setActivites([]);
    }
    setIsLoading(false);
  };

  const loadMoreActivities = () => {
    const nextPage = currentPage + 1;
    fetchActivities(accessToken, nextPage, false);
  };

  const handleDistanceSelect = (preset) => {
    setSelectedDistance(preset);
    setShowCustomInput(false);
    setCustomDistance('');
  };

  const handleCustomDistance = () => {
    if (customDistance && parseFloat(customDistance) > 0) {
      const customPreset = {
        label: `${customDistance}K`,
        distance: parseFloat(customDistance),
        tolerance: Math.max(0.5, parseFloat(customDistance) * 0.1) // 10% tolerance, minimum 0.5km
      };
      setSelectedDistance(customPreset);
    }
  };

  const filterActivitiesByDistance = () => {
    if (!selectedDistance || !activities.length) return [];
    
    return activities.filter(activity => {
      const activityDistanceKm = activity.distance / 1000;
      const minDistance = selectedDistance.distance - selectedDistance.tolerance;
      const maxDistance = selectedDistance.distance + selectedDistance.tolerance;
      return activityDistanceKm >= minDistance && activityDistanceKm <= maxDistance;
    }).sort((a, b) => {
      // Sort by pace (fastest first)
      const paceA = a.moving_time / (a.distance / 1000);
      const paceB = b.moving_time / (b.distance / 1000);
      return paceA - paceB;
    });
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPace = (seconds, distanceKm) => {
    const pacePerKm = seconds / distanceKm;
    const minutes = Math.floor(pacePerKm / 60);
    const secs = Math.floor(pacePerKm % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')} /km`;
  };

  const filteredActivities = filterActivitiesByDistance();

  return (
    <div className="app-container">
      {!isLoggedIn ? (
        <div>
          <h1>Run Performance Analyzer</h1>
          <div className="login-section">
            <h1>Welcome</h1>
            <p className="login-subtitle">Connect your Strava account to analyze and compare your running performance across similar distances</p>
            {error && (
              <div className="error-message">
                ⚠️ {error}
              </div>
            )}
            <button onClick={handleStravaLogin} className="strava-login-btn" disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Connect with Strava'}
            </button>
          </div>
        </div>
      ) : (
        <div className="dashboard-section">
          <h1>Run Performance Analyzer</h1>
          
          {isLoading && activities.length === 0 ? (
            <div className="loading-message">
              <p>Loading your activities...</p>
            </div>
          ) : (
            <div className="performance-container">
              <div className="distance-selector">
                <h3>Select Distance to Compare</h3>
                <div className="distance-buttons">
                  {distancePresets.map((preset, index) => (
                    <button
                      key={index}
                      onClick={() => handleDistanceSelect(preset)}
                      className={`distance-btn ${selectedDistance?.label === preset.label ? 'active' : ''}`}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setShowCustomInput(!showCustomInput);
                      setSelectedDistance(null);
                    }}
                    className={`distance-btn custom-btn ${showCustomInput ? 'active' : ''}`}
                  >
                    Custom
                  </button>
                </div>
                
                {showCustomInput && (
                  <div className="custom-distance-input">
                    <input
                      type="number"
                      value={customDistance}
                      onChange={(e) => setCustomDistance(e.target.value)}
                      placeholder="Enter distance in km"
                      min="0.1"
                      step="0.1"
                    />
                    <button onClick={handleCustomDistance} className="apply-custom-btn">
                      Apply
                    </button>
                  </div>
                )}
              </div>

              {selectedDistance && (
                <div className="results-section">
                  <h3>
                    {selectedDistance.label} Runs 
                    ({selectedDistance.distance - selectedDistance.tolerance}km - {selectedDistance.distance + selectedDistance.tolerance}km)
                    <span className="results-count">({filteredActivities.length} runs found)</span>
                  </h3>
                  
                  {filteredActivities.length === 0 ? (
                    <div className="no-results">
                      <p>No runs found in this distance range. Try loading more activities or selecting a different distance.</p>
                      {hasMoreActivities && (
                        <button onClick={loadMoreActivities} className="load-more-btn" disabled={isLoading}>
                          {isLoading ? 'Loading...' : 'Load More Activities'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="activities-grid">
                        {filteredActivities.map((activity, i) => (
                          <div 
                            key={activity.id} 
                            className={`activity-card clickable performance-card ${i === 0 ? 'best-performance' : ''}`}
                            onClick={() => window.open(`https://www.strava.com/activities/${activity.id}`, '_blank')}
                          >
                            {i === 0 && <div className="best-badge">🏆 Best Time</div>}
                            <strong>{activity.name}</strong>
                            
                            <div className="performance-stats">
                              <div className="stat-row">
                                <span className="stat-label">Distance:</span>
                                <span className="stat-value">{(activity.distance / 1000).toFixed(2)} km</span>
                              </div>
                              
                              <div className="stat-row">
                                <span className="stat-label">Time:</span>
                                <span className="stat-value">{formatTime(activity.moving_time)}</span>
                              </div>
                              
                              <div className="stat-row">
                                <span className="stat-label">Pace:</span>
                                <span className="stat-value">{formatPace(activity.moving_time, activity.distance / 1000)}</span>
                              </div>
                              
                              {activity.average_heartrate && (
                                <div className="stat-row">
                                  <span className="stat-label">Avg HR:</span>
                                  <span className="stat-value">{Math.round(activity.average_heartrate)} bpm</span>
                                </div>
                              )}
                              
                              <div className="stat-row">
                                <span className="stat-label">Date:</span>
                                <span className="stat-value">{new Date(activity.start_date).toLocaleDateString()}</span>
                              </div>
                            </div>
                            
                            <div className="click-hint">Click to view on Strava →</div>
                          </div>
                        ))}
                      </div>
                      
                      {hasMoreActivities && (
                        <div className="load-more-section">
                          <button onClick={loadMoreActivities} className="load-more-btn" disabled={isLoading}>
                            {isLoading ? 'Loading...' : 'Load More Activities'}
                          </button>
                          <p className="load-more-hint">Load more activities to find additional runs in this distance range</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              
              {!selectedDistance && !showCustomInput && activities.length > 0 && (
                <div className="welcome-message">
                  <h3>🏃‍♂️ Ready to analyze your performance!</h3>
                  <p>Select a distance above to compare your runs and see how you've improved over time.</p>
                  <p>Loaded {activities.length} runs from your Strava account.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;