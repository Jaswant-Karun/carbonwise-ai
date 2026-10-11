const db = require('../config/db');
const { calculateActivityEmissions } = require('../services/carbonIntelligenceService');
//Added new Activity
// @desc    Add a new activity
// @route   POST /api/activities
const addActivity = async (req, res) => {
  try {
    const { activity_type, details } = req.body;
    const carbon_emissions = calculateActivityEmissions(activity_type, details);
    
    const newActivity = await db.query(
      'INSERT INTO activities (user_id, activity_type, details, carbon_emissions) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, activity_type, details, carbon_emissions]
    );

    res.status(201).json(newActivity.rows[0]);
  } catch (error) {
    console.error('Add Activity Error:', error);
    res.status(error.statusCode || 500).json({ message: error.message || 'Server error adding activity' });
  }
};

const deleteActivity = async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM activities WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id],
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Activity not found.' });
    res.status(204).send();
  } catch (error) {
    console.error('Delete Activity Error:', error);
    res.status(500).json({ message: 'Server error deleting activity' });
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

module.exports = { addActivity, getActivities, deleteActivity };
