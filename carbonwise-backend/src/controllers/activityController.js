const db = require('../config/db');

// @desc    Add a new activity
// @route   POST /api/activities
const addActivity = async (req, res) => {
  try {
    const { activity_type, details, carbon_emissions } = req.body;
    
    // In a real application, calculate emissions here based on details
    // For now, assume it's passed or calculated simply
    
    const newActivity = await db.query(
      'INSERT INTO activities (user_id, activity_type, details, carbon_emissions) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, activity_type, details, carbon_emissions]
    );

    res.status(201).json(newActivity.rows[0]);
  } catch (error) {
    console.error('Add Activity Error:', error);
    res.status(500).json({ message: 'Server error adding activity' });
  }
};

// @desc    Get user activities
// @route   GET /api/activities
const getActivities = async (req, res) => {
  try {
    const activitiesResult = await db.query(
      'SELECT * FROM activities WHERE user_id = $1 ORDER BY date DESC',
      [req.user.id]
    );
    res.json(activitiesResult.rows);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching activities' });
  }
};

module.exports = { addActivity, getActivities };
