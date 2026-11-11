const db = require('../config/db');
const { calculateActivityEmissions } = require('../services/carbonIntelligenceService');

// @desc    Add a new activity
// @route   POST /api/activities
const addActivity = async (req, res) => {
  try {
    const activity_type = req.body.activity_type || req.body.activityType;
    const details = req.body.details || {};
    if (req.body.notes !== undefined) {
      details.notes = req.body.notes;
    }
    if (req.body.title !== undefined) {
      details.title = req.body.title;
    }

    const carbon_emissions = calculateActivityEmissions(activity_type, details);
    const date = req.body.date ? req.body.date : new Date().toISOString().slice(0, 10);

    const newActivity = await db.query(
      `INSERT INTO activities (user_id, activity_type, details, carbon_emissions, date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, activity_type, details, carbon_emissions, date]
    );

    res.status(201).json(newActivity.rows[0]);
  } catch (error) {
    console.error('Add Activity Error:', error);
    res.status(error.statusCode || 500).json({ message: error.message || 'Server error adding activity' });
  }
};

// @desc    Get user activities with filtering, search, and pagination
// @route   GET /api/activities
const getActivities = async (req, res) => {
  try {
    const { category, startDate, endDate, search, page, limit, paginated } = req.query;
    const conditions = ['user_id = $1'];
    const params = [req.user.id];

    if (category && category !== 'all') {
      params.push(category.trim().toLowerCase());
      conditions.push(`LOWER(activity_type) = $${params.length}`);
    }

    if (startDate) {
      params.push(startDate);
      conditions.push(`date >= $${params.length}::date`);
    }

    if (endDate) {
      params.push(endDate);
      conditions.push(`date <= $${params.length}::date`);
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      conditions.push(`(LOWER(activity_type) LIKE $${params.length} OR LOWER(details::text) LIKE $${params.length})`);
    }

    const whereClause = conditions.join(' AND ');

    const isPaginated = paginated === 'true' || (page !== undefined && limit !== undefined);

    if (isPaginated) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
      const offset = (pageNum - 1) * limitNum;

      const countResult = await db.query(
        `SELECT COUNT(*) FROM activities WHERE ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count, 10);

      const pageParams = [...params, limitNum, offset];
      const activitiesResult = await db.query(
        `SELECT * FROM activities WHERE ${whereClause} ORDER BY date DESC, id DESC LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`,
        pageParams
      );

      return res.json({
        activities: activitiesResult.rows,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        limit: limitNum,
      });
    }

    const activitiesResult = await db.query(
      `SELECT * FROM activities WHERE ${whereClause} ORDER BY date DESC, id DESC`,
      params
    );
    res.json(activitiesResult.rows);
  } catch (error) {
    console.error('Get Activities Error:', error);
    res.status(500).json({ message: 'Server error fetching activities' });
  }
};

// @desc    Get a single activity by ID
// @route   GET /api/activities/:id
const getActivity = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM activities WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Activity not found.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get Activity Error:', error);
    res.status(500).json({ message: 'Server error fetching activity' });
  }
};

// @desc    Update an existing activity
// @route   PUT /api/activities/:id
const updateActivity = async (req, res) => {
  try {
    const existing = await db.query(
      'SELECT * FROM activities WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!existing.rows[0]) {
      return res.status(404).json({ message: 'Activity not found.' });
    }

    const current = existing.rows[0];
    const activity_type = req.body.activity_type || req.body.activityType || current.activity_type;
    const details = req.body.details !== undefined ? req.body.details : current.details;
    if (req.body.notes !== undefined) {
      details.notes = req.body.notes;
    }
    if (req.body.title !== undefined) {
      details.title = req.body.title;
    }

    const date = req.body.date ? req.body.date : (current.date instanceof Date ? current.date.toISOString().slice(0, 10) : String(current.date).slice(0, 10));
    const carbon_emissions = calculateActivityEmissions(activity_type, details);

    const updated = await db.query(
      `UPDATE activities
       SET activity_type = $1, details = $2, carbon_emissions = $3, date = $4
       WHERE id = $5 AND user_id = $6 RETURNING *`,
      [activity_type, details, carbon_emissions, date, req.params.id, req.user.id]
    );

    res.json(updated.rows[0]);
  } catch (error) {
    console.error('Update Activity Error:', error);
    res.status(error.statusCode || 500).json({ message: error.message || 'Server error updating activity' });
  }
};

// @desc    Delete an activity
// @route   DELETE /api/activities/:id
const deleteActivity = async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM activities WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Activity not found.' });
    res.status(204).send();
  } catch (error) {
    console.error('Delete Activity Error:', error);
    res.status(500).json({ message: 'Server error deleting activity' });
  }
};

module.exports = {
  addActivity,
  getActivities,
  getActivity,
  updateActivity,
  deleteActivity,
};
