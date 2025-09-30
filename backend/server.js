const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
require('dotenv').config({path: "../.env"});

const app = express();

app.use(cors());
app.use(express.json({ limit: '100mb' })); // Increase limit for large activity arrays
app.use(express.urlencoded({ limit: '100mb', extended: true }));

let db;
const client = new MongoClient(process.env.ATLAS_URI);

client.connect()
  .then(() => {
    db = client.db("StravaData");
    console.log('Connected to MongoDB');
  })
  .catch(err => console.error('MongoDB connection error:', err));

app.post('/api/activities/save', async (req, res) => {
  try {
    const { activities, athleteId, athleteName } = req.body;
    
    if (!activities || !athleteId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const collectionName = `user_${athleteId}`;
    const collection = db.collection(collectionName);
    
    const operations = activities.map(activity => ({
      updateOne: {
        filter: { stravaId: activity.id },
        update: {
          $set: {
            stravaId: activity.id,
            name: activity.name,
            distance: activity.distance,
            movingTime: activity.moving_time,
            averageHeartrate: activity.average_heartrate || null,
            type: activity.type,
            startDate: new Date(activity.start_date),
            athleteName: athleteName,
            updatedAt: new Date()
          },
          $setOnInsert: {
            createdAt: new Date()
          }
        },
        upsert: true
      }
    }));
    
    const result = await collection.bulkWrite(operations);
    
    res.json({ 
      success: true, 
      upserted: result.upsertedCount,
      modified: result.modifiedCount
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/activities/:athleteId/all', async (req, res) => {
  try {
    const { athleteId } = req.params;
    const collectionName = `user_${athleteId}`;
    const collection = db.collection(collectionName);
    
    const activities = await collection
      .find({ type: 'Run' })
      .sort({ startDate: -1 })
      .toArray();
    
    res.json(activities);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));