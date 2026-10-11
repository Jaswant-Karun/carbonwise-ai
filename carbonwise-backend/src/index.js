const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const { initDb } = require('./models/schema');

// Initialize Database Tables
initDb();

// Middleware
app.use(cors());
app.use(express.json());
//Added new Activity Router
// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'CarbonWise API is running!' });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/activities', require('./routes/activityRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/intelligence', require('./routes/intelligenceRoutes'));
app.use('/api/scenarios', require('./routes/scenarioRoutes'));
app.use('/api/coach', require('./routes/coachRoutes'));
app.use('/api/forecast', require('./routes/forecastRoutes'));
app.use('/api/impact', require('./routes/impactRoutes'));
app.use('/api/environment', require('./routes/environmentRoutes'));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
