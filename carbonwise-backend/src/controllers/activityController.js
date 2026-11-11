const db = require('../config/db');
const { calculateEmissions, recordActivityEmission } = require('../services/emissionEngineService');
const { calculateActivityEmissions } = require('../services/carbonIntelligenceService');

// @desc    Add a new activity
// @route   POST /api/activities
const addActivity = async (req, res) => {
  try {
    const activity_type = req.body.activity_type || req.body.activityType;
    if (!activity_type || typeof activity_type !== 'string' || !activity_type.trim()) {
      return res.status(400).json({ message: 'Valid activity_type is required.' });
    }

    const details = req.body.details && typeof req.body.details === 'object' ? { ...req.body.details } : {};
    if (req.body.notes !== undefined) {
      details.notes = String(req.body.notes).slice(0, 1000);
    }
    if (req.body.title !== undefined) {
      details.title = String(req.body.title).slice(0, 200);
    }

    const calcResult = calculateEmissions({
      category: activity_type,
      details,
      region: req.body.region || 'Global',
    });

    const explicitEmissions = req.body.carbonEmissions !== undefined && req.body.carbonEmissions !== null
      ? Number(req.body.carbonEmissions)
      : (req.body.carbon_emissions !== undefined && req.body.carbon_emissions !== null
        ? Number(req.body.carbon_emissions)
        : null);

    const carbon_emissions = explicitEmissions !== null ? explicitEmissions : calcResult.emissionsKg;
    if (!Number.isFinite(carbon_emissions) || carbon_emissions < 0) {
      return res.status(400).json({ message: 'Calculated or explicit emissions must be a non-negative finite number.' });
    }

    if (explicitEmissions !== null) {
      calcResult.emissionsKg = explicitEmissions;
      calcResult.emissionsTonnes = Number((explicitEmissions / 1000).toFixed(4));
    }

    details.emissions_tonnes = calcResult.emissionsTonnes;
    details.scope = calcResult.scope;
    details.methodology = calcResult.methodology;
    details.assumptions = calcResult.assumptions;
    details.factor_used = calcResult.factorUsed;
    details.is_estimate = true;

    // Validate and sanitize date
    let dateStr;
    if (req.body.date || req.body.activity_date) {
      const parsedDate = new Date(req.body.date || req.body.activity_date);
      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: 'Invalid activity date provided.' });
      }
      dateStr = parsedDate.toISOString().slice(0, 10);
    } else {
      dateStr = new Date().toISOString().slice(0, 10);
    }

    // Optional Idempotency Protection (prevent double-submit)
    const idempotencyKey = (req.headers && req.headers['x-idempotency-key']) || (req.body && (req.body.idempotency_key || req.body.idempotencyKey));
    if (idempotencyKey) {
      const existingKeyMatch = await db.query(
        `SELECT a.* FROM activities a
         WHERE a.user_id = $1 AND a.details->>'idempotency_key' = $2
         LIMIT 1`,
        [req.user.id, String(idempotencyKey)]
      );
      if (existingKeyMatch.rows.length > 0) {
        return res.status(200).json(existingKeyMatch.rows[0]);
      }
      details.idempotency_key = String(idempotencyKey);
    }

    const newActivity = await db.query(
      `INSERT INTO activities (user_id, activity_type, details, carbon_emissions, date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, activity_type, details, carbon_emissions, dateStr]
    );

    const activityRow = newActivity.rows[0];

    // Connect activity log directly to its calculated emission record
    await recordActivityEmission({
      activityId: activityRow.id,
      userId: req.user.id,
      calculation: calcResult,
    });

    res.status(201).json(activityRow);
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
    if (!activity_type || typeof activity_type !== 'string' || !activity_type.trim()) {
      return res.status(400).json({ message: 'Valid activity_type is required.' });
    }

    const details = req.body.details !== undefined && typeof req.body.details === 'object' ? { ...req.body.details } : current.details;
    if (req.body.notes !== undefined) {
      details.notes = String(req.body.notes).slice(0, 1000);
    }
    if (req.body.title !== undefined) {
      details.title = String(req.body.title).slice(0, 200);
    }

    let dateStr;
    if (req.body.date || req.body.activity_date) {
      const parsedDate = new Date(req.body.date || req.body.activity_date);
      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: 'Invalid activity date provided.' });
      }
      dateStr = parsedDate.toISOString().slice(0, 10);
    } else {
      dateStr = current.date instanceof Date ? current.date.toISOString().slice(0, 10) : String(current.date).slice(0, 10);
    }

    const calcResult = calculateEmissions({
      category: activity_type,
      details,
      region: req.body.region || 'Global',
    });

    const explicitEmissions = req.body.carbonEmissions !== undefined && req.body.carbonEmissions !== null
      ? Number(req.body.carbonEmissions)
      : (req.body.carbon_emissions !== undefined && req.body.carbon_emissions !== null
        ? Number(req.body.carbon_emissions)
        : null);

    const carbon_emissions = explicitEmissions !== null ? explicitEmissions : calcResult.emissionsKg;
    if (!Number.isFinite(carbon_emissions) || carbon_emissions < 0) {
      return res.status(400).json({ message: 'Emissions must be a non-negative finite number.' });
    }

    if (explicitEmissions !== null) {
      calcResult.emissionsKg = explicitEmissions;
      calcResult.emissionsTonnes = Number((explicitEmissions / 1000).toFixed(4));
    }

    details.emissions_tonnes = calcResult.emissionsTonnes;
    details.scope = calcResult.scope;
    details.methodology = calcResult.methodology;
    details.assumptions = calcResult.assumptions;
    details.factor_used = calcResult.factorUsed;
    details.is_estimate = true;

    const updated = await db.query(
      `UPDATE activities
       SET activity_type = $1, details = $2, carbon_emissions = $3, date = $4
       WHERE id = $5 AND user_id = $6 RETURNING *`,
      [activity_type, details, carbon_emissions, dateStr, req.params.id, req.user.id]
    );

    // Update connected activity_emissions record
    await db.query('DELETE FROM activity_emissions WHERE activity_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    await recordActivityEmission({
      activityId: req.params.id,
      userId: req.user.id,
      calculation: calcResult,
    });

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
