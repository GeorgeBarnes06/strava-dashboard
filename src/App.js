import React, { useEffect, useState } from 'react';
import './App.css';
import axios from 'axios'
import polyline from '@mapbox/polyline'

function App() {
  const [activities, setActivites] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  
  const clientID = "";
  const clientSecret = "";
  const refreshToken = ""
  const auth_link = "https://www.strava.com/oauth/token"
  const activities_link = `https://www.strava.com/api/v3/athlete/activities`

  const handleStravaLogin = () => {
    // Redirect to Strava OAuth
    const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${clientID}&response_type=code&redirect_uri=http://localhost:3000&approval_prompt=force&scope=read,activity:read_all`;
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
      
    } catch (error) {
      console.error('Error exchanging code for token:', error);
    }
  };

  const fetchActivities = async () => {
    if (!accessToken) return;
    
    try {
      const response = await axios.get(`${activities_link}?access_token=${accessToken}`);
      console.log('Activities:', response.data);
      setActivites(response.data);
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  return (
    <div className="app-container">
      <h1>Strava Dashboard</h1>
      {!isLoggedIn ? (
        <div>
          <p>Please log in with your Strava account to continue.</p>
          <button onClick={handleStravaLogin} className="strava-login-btn">
            Connect with Strava
          </button>
        </div>
      ) : (
        <div>
          <p className="success-message">✅ Successfully connected to Strava!</p>
          <button onClick={fetchActivities} className="load-activities-btn">
            Load Activities
          </button>
          
          {activities.length > 0 && (
            <div className="activities-container">
              <h3>Your Recent Activities:</h3>
              {activities.slice(0, 10).map((activity, i) => (
                <div key={i} className="activity-card">
                  <strong>{activity.name}</strong>
                  <p>Type: {activity.type}</p>
                  <p>Distance: {(activity.distance / 1000).toFixed(2)} km</p>
                  <p>Elevation Gain: {activity.total_elevation_gain} m</p>
                  <p>Date: {new Date(activity.start_date).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;