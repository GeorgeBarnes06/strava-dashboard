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
  const [athleteId, setAthleteId] = useState(null);
  const [athleteName, setAthleteName] = useState(null);
  const [loadedFromDB, setLoadedFromDB] = useState(false);
  
  const clientID = process.env.REACT_APP_STRAVA_CLIENT_ID;
  const clientSecret = process.env.REACT_APP_STRAVA_CLIENT_SECRET;
  const refreshToken = process.env.REACT_APP_REFRESH_TOKEN;
  const activities_link = `https://www.strava.com/api/v3/athlete/activities`
  const backend_url = 'http://localhost:5000';

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
      const athId = response.data.athlete.id;
      const athName = `${response.data.athlete.firstname} ${response.data.athlete.lastname}`;
      setAthleteId(athId);
      setAthleteName(athName);
      setIsLoggedIn(true);
      
      window.history.replaceState({}, document.title, "/");
      
      // Try loading from database first
      const loadedFromDB = await loadActivitiesFromDB(athId);
      
      // If no data in DB, fetch from Strava
      if (!loadedFromDB) {
        console.log('No cached data found, fetching from Strava...');
        await fetchActivities(response.data.access_token, 1, true, athId, athName);
      }
      
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      setError('Failed to authenticate with Strava. Please try again.');
      setIsLoggedIn(false);
      setAccessToken(null);
    }
    setIsLoading(false);
  };

  const loadActivitiesFromDB = async (athleteId) => {
    try {
      const response = await axios.get(`${backend_url}/api/activities/${athleteId}/all`);
      if (response.data.length > 0) {
        // Convert MongoDB data back to Strava format
        const formattedActivities = response.data.map(activity => ({
          id: activity.stravaId,
          name: activity.name,
          distance: activity.distance,
          moving_time: activity.movingTime,
          average_heartrate: activity.averageHeartrate,
          type: activity.type,
          start_date: activity.startDate
        }));
        setActivites(formattedActivities);
        setLoadedFromDB(true);
        console.log(`Loaded ${formattedActivities.length} activities from database`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error loading from DB:', error);
      return false;
    }
  };

  const saveActivitiesToDB = async (activities, athleteId, athleteName) => {
    try {
      const response = await axios.post(`${backend_url}/api/activities/save`, {
        activities: activities,
        athleteId: athleteId,
        athleteName: athleteName
      });
      console.log('Saved to database:', response.data);
    } catch (error) {
      console.error('Error saving to database:', error);
    }
  };

  const fetchActivities = async (token = accessToken, page = 1, resetActivities = false, athId = athleteId, athName = athleteName) => {
    if (!token) return;
    
    setIsLoading(true);
    try {
      const perPage = 200;
      const response = await axios.get(`${activities_link}?access_token=${token}&page=${page}&per_page=${perPage}`);
      
      const newActivities = response.data;
      const runActivities = newActivities.filter(activity => activity.type === 'Run');
      
      if (resetActivities || page === 1) {
        setActivites(runActivities);
      } else {
        setActivites(prev => [...prev, ...runActivities]);
      }
      
      // Save to MongoDB
      if (runActivities.length > 0 && athId) {
        await saveActivitiesToDB(runActivities, athId, athName);
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
        tolerance: Math.max(0.5, parseFloat(customDistance) * 0.1)
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
      const paceA = a.moving_time / (a.distance / 1000);
      const paceB = b.moving_time / (b.distance / 1000);
      return paceA - paceB;
    });
  };

  const calculatePerformanceStats = (activities) => {
    if (!activities.length) return null;

    const stats = {
      totalRuns: activities.length,
      avgPace: 0,
      avgHeartRate: 0,
      bestTime: activities[0]?.moving_time || 0,
      improvement: 0
    };

    const totalPace = activities.reduce((sum, activity) => {
      return sum + (activity.moving_time / (activity.distance / 1000));
    }, 0);
    stats.avgPace = totalPace / activities.length;

    const activitiesWithHR = activities.filter(a => a.average_heartrate);
    if (activitiesWithHR.length > 0) {
      stats.avgHeartRate = activitiesWithHR.reduce((sum, activity) => {
        return sum + activity.average_heartrate;
      }, 0) / activitiesWithHR.length;
    }

    if (activities.length >= 6) {
      const recent = activities.slice(-3);
      const early = activities.slice(0, 3);
      const recentAvgPace = recent.reduce((sum, a) => sum + (a.moving_time / (a.distance / 1000)), 0) / 3;
      const earlyAvgPace = early.reduce((sum, a) => sum + (a.moving_time / (a.distance / 1000)), 0) / 3;
      stats.improvement = ((earlyAvgPace - recentAvgPace) / earlyAvgPace) * 100;
    }

    return stats;
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

  const SimpleChart = ({ data, label, color = '#007bff' }) => {
    if (!data || data.length < 2) return null;

    const maxValue = Math.max(...data.map(d => d.value));
    const minValue = Math.min(...data.map(d => d.value));
    const range = maxValue - minValue || 1;

    return (
      <div className="simple-chart">
        <h4>{label}</h4>
        <div className="chart-container">
          <svg viewBox="0 0 400 200" className="chart-svg">
            {[0, 1, 2, 3, 4].map(i => (
              <line
                key={i}
                x1={0}
                y1={40 + i * 32}
                x2={400}
                y2={40 + i * 32}
                stroke="#f0f0f0"
                strokeWidth="1"
              />
            ))}
            
            <polyline
              fill="none"
              stroke={color}
              strokeWidth="3"
              points={data.map((point, index) => {
                const x = (index / (data.length - 1)) * 380 + 10;
                const y = 180 - ((point.value - minValue) / range) * 140;
                return `${x},${y}`;
              }).join(' ')}
            />
            
            {data.map((point, index) => {
              const x = (index / (data.length - 1)) * 380 + 10;
              const y = 180 - ((point.value - minValue) / range) * 140;
              return (
                <circle
                  key={index}
                  cx={x}
                  cy={y}
                  r="4"
                  fill={color}
                  className="chart-point"
                />
              );
            })}
          </svg>
          <div className="chart-labels">
            <span>Oldest</span>
            <span>Most Recent</span>
          </div>
        </div>
      </div>
    );
  };

  const filteredActivities = filterActivitiesByDistance();
  const performanceStats = calculatePerformanceStats(filteredActivities);

  return (
    <div className="app-container">
      {!isLoggedIn ? (
        <div className="login-wrapper">
          <h1>Run Performance Analyzer</h1>
          <div className="login-section">
            <h1>Welcome</h1>
            <p className="login-subtitle">Connect your Strava account to analyze and compare your running performance across similar distances</p>
            {error && (
              <div className="error-message">
                {error}
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
              {loadedFromDB && (
                <div className="db-status">
                  Loaded from database - <button onClick={() => fetchActivities(accessToken, 1, true)} className="refresh-btn">Refresh from Strava</button>
                </div>
              )}
              
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

              {selectedDistance && filteredActivities.length > 0 && (
                <div className="results-section">
                  <h3>
                    {selectedDistance.label} Runs 
                    ({selectedDistance.distance - selectedDistance.tolerance}km - {selectedDistance.distance + selectedDistance.tolerance}km)
                    <span className="results-count">({filteredActivities.length} runs found)</span>
                  </h3>

                  {performanceStats && (
                    <div className="analytics-section">
                      <h4>Performance Analytics</h4>
                      
                      <div className="stats-grid">
                        <div className="stat-card">
                          <div className="stat-number">{performanceStats.totalRuns}</div>
                          <div className="stat-label">Total Runs</div>
                        </div>
                        
                        <div className="stat-card">
                          <div className="stat-number">
                            {Math.floor(performanceStats.avgPace / 60)}:
                            {Math.floor(performanceStats.avgPace % 60).toString().padStart(2, '0')}
                          </div>
                          <div className="stat-label">Avg Pace /km</div>
                        </div>
                        
                        {performanceStats.avgHeartRate > 0 && (
                          <div className="stat-card">
                            <div className="stat-number">{Math.round(performanceStats.avgHeartRate)}</div>
                            <div className="stat-label">Avg Heart Rate</div>
                          </div>
                        )}
                        
                        <div className="stat-card">
                          <div className="stat-number">{formatTime(performanceStats.bestTime)}</div>
                          <div className="stat-label">Best Time</div>
                        </div>
                        
                        {Math.abs(performanceStats.improvement) > 0.5 && (
                          <div className={`stat-card ${performanceStats.improvement > 0 ? 'improvement' : 'decline'}`}>
                            <div className="stat-number">
                              {performanceStats.improvement > 0 ? '+' : ''}{performanceStats.improvement.toFixed(1)}%
                            </div>
                            <div className="stat-label">
                              {performanceStats.improvement > 0 ? 'Improvement' : 'Change'} in Pace
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="charts-section">
                        <SimpleChart 
                          data={[...filteredActivities].reverse().map((activity) => ({
                            value: activity.moving_time / (activity.distance / 1000),
                            label: new Date(activity.start_date).toLocaleDateString()
                          }))}
                          label="Pace Over Time (seconds per km)"
                          color="#007bff"
                        />

                        {filteredActivities.filter(a => a.average_heartrate).length > 1 && (
                          <SimpleChart 
                            data={[...filteredActivities].reverse().filter(a => a.average_heartrate).map((activity) => ({
                              value: activity.average_heartrate,
                              label: new Date(activity.start_date).toLocaleDateString()
                            }))}
                            label="Average Heart Rate Over Time (bpm)"
                            color="#dc3545"
                          />
                        )}

                        <SimpleChart 
                          data={[...filteredActivities].reverse().map((activity) => ({
                            value: activity.distance / 1000,
                            label: new Date(activity.start_date).toLocaleDateString()
                          }))}
                          label="Distance Consistency (km)"
                          color="#28a745"
                        />
                      </div>
                    </div>
                  )}
                  
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
                            {i === 0 && <div className="best-badge">Best Time</div>}
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
                            
                            <div className="click-hint">Click to view on Strava</div>
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
                  <h3>Ready to analyze your performance</h3>
                  <p>Select a distance above to compare your runs and see how you've improved over time.</p>
                  <p>Loaded {activities.length} runs from {loadedFromDB ? 'database' : 'Strava'}.</p>
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