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
  
  const clientID = process.env.REACT_APP_STRAVA_CLIENT_ID;
  const clientSecret = process.env.REACT_APP_STRAVA_CLIENT_SECRET;
  const refreshToken = process.env.REACT_APP_REFRESH_TOKEN;
  const activities_link = `https://www.strava.com/api/v3/athlete/activities`

  const handleStravaLogin = () => {
    setError(null); // Clear any previous errors
    // Redirect to Strava OAuth
    const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${clientID}&response_type=code&redirect_uri=http://localhost:3000/&approval_prompt=force&scope=read,activity:read_all`;
    window.location.href = stravaAuthUrl;
  };

  useEffect(() => {
    // Check if there's an authorization code in the URL (after redirect from Strava)
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');
    
    if (authCode && !isLoggedIn) {
      // Exchange authorization code for access token
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
      
      // Clear the code from URL
      window.history.replaceState({}, document.title, "/");
      
      // Automatically fetch activities after successful login
      await fetchActivities(response.data.access_token, 1, true); // Reset to page 1
      
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
      const perPage = 200; // Maximum allowed by Strava API
      const response = await axios.get(`${activities_link}?access_token=${token}&page=${page}&per_page=${perPage}`);
      console.log('Activities:', response.data);
      
      const newActivities = response.data;
      // Filter to only include runs
      const runActivities = newActivities.filter(activity => activity.type === 'Run');
      
      if (resetActivities || page === 1) {
        setActivites(runActivities);
      } else {
        setActivites(prev => [...prev, ...runActivities]);
      }
      
      // Check if we have more activities to load
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

  return (
    <div className="app-container">
      {!isLoggedIn ? (
        <div>
          <h1>Strava Dashboard</h1>
          <div className="login-section">
            <h1>Welcome</h1>
            <p className="login-subtitle">Connect your Strava account to visualize your activities and track your progress</p>
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
          <h1>Strava Dashboard</h1>
          
          {isLoading && activities.length === 0 ? (
            <div className="loading-message">
              <p>Loading your activities...</p>
            </div>
          ) : (
            activities.length > 0 && (
              <div className="activities-container">
                <div className="activities-header">
                  <h3>Your Running Activities ({activities.length})</h3>
                </div>
                
                <div className="activities-grid">
                  {activities.map((activity, i) => (
                    <div 
                      key={i} 
                      className="activity-card clickable"
                      onClick={() => window.open(`https://www.strava.com/activities/${activity.id}`, '_blank')}
                    >
                      <strong>{activity.name}</strong>
                      <p><span className="activity-stat">Type: {activity.type}</span></p>
                      <p><span className="activity-stat">Distance: {(activity.distance / 1000).toFixed(2)} km</span></p>
                      <p><span className="activity-stat">Elevation: {activity.total_elevation_gain} m</span></p>
                      <p><span className="activity-stat">Date: {new Date(activity.start_date).toLocaleDateString()}</span></p>
                      <div className="click-hint">Click to view on Strava →</div>
                    </div>
                  ))}
                </div>
                
                {hasMoreActivities && (
                  <div className="load-more-section">
                    <button 
                      onClick={loadMoreActivities} 
                      className="load-more-btn" 
                      disabled={isLoading}
                    >
                      {isLoading ? 'Loading...' : 'Load More Activities'}
                    </button>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default App;