const db = require('../config/db');
const {
  SCIENTIFIC_EMISSION_FACTORS,
  calculateEmissions,
  round,
} = require('../services/emissionEngineService');

// @desc    Get all centralized scientific emission factors
// @route   GET /api/emissions/factors
const getFactors = async (req, res) => {
  try {
    const { category, region, scope } = req.query;

    const conditions = [];
    const params = [];

    if (category && category !== 'all') {
      params.push(category.toLowerCase());
      conditions.push(`LOWER(category) = $${params.length}`);
    }

    if (region && region !== 'all') {
      params.push(region.toLowerCase());
      conditions.push(`LOWER(region) = $${params.length}`);
    }

    if (scope && scope !== 'all') {
      params.push(scope.toLowerCase());
      conditions.push(`LOWER(scope) = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const dbRes = await db.query(
      `SELECT * FROM emission_factors ${where} ORDER BY category ASC, activity_key ASC`,
      params
    );

    if (dbRes.rows.length > 0) {
      return res.json(dbRes.rows);
    }

    // In-memory fallback
    let filtered = SCIENTIFIC_EMISSION_FACTORS;
    if (category && category !== 'all') {
      filtered = filtered.filter((f) => f.category === category.toLowerCase());
    }
    if (region && region !== 'all') {
      filtered = filtered.filter((f) => f.region.toLowerCase() === region.toLowerCase());
    }
    if (scope && scope !== 'all') {
      filtered = filtered.filter((f) => f.scope.toLowerCase() === scope.toLowerCase());
    }

    res.json(filtered);
  } catch (error) {
    console.error('Get Factors Error:', error);
    res.status(500).json({ message: 'Error retrieving emission factors' });
  }
};

// @desc    Calculate emissions with unit conversion and methodology metadata
// @route   POST /api/emissions/calculate
const calculate = async (req, res) => {
  try {
    const { category, subType, quantity, unit, region, details } = req.body;

    if (!category) {
      return res.status(400).json({ message: 'Emission category is required.' });
    }

    const result = calculateEmissions({
      category,
      subType,
      quantity,
      unit,
      region: region || 'Global',
      details: details || {},
    });

    res.json(result);
  } catch (error) {
    console.error('Calculate Emissions Error:', error);
    res.status(error.statusCode || 400).json({ message: error.message || 'Calculation error' });
  }
};

// @desc    Get user category-wise and total emissions (both kg and tonnes)
// @route   GET /api/emissions/summary
const getSummary = async (req, res) => {
  try {
    const activitiesRes = await db.query(
      `SELECT id, activity_type, details, carbon_emissions, date
       FROM activities
       WHERE user_id = $1
       ORDER BY date DESC`,
      [req.user.id]
    );

    const rows = activitiesRes.rows;
    let totalKg = 0;
    const catMap = {};
    const scopeMap = { 'Scope 1': 0, 'Scope 2': 0, 'Scope 3': 0 };

    for (const act of rows) {
      const kg = Number(act.carbon_emissions || 0);
      if (Number.isFinite(kg) && kg >= 0) {
        totalKg += kg;
        const cat = (act.activity_type || 'other').toLowerCase();
        catMap[cat] = (catMap[cat] || 0) + kg;

        // Categorize Scope
        const d = act.details || {};
        const scope = d.scope || (cat === 'electricity' ? 'Scope 2' : (cat === 'transport' && d.transportMode?.startsWith('car_') ? 'Scope 1' : 'Scope 3'));
        scopeMap[scope] = (scopeMap[scope] || 0) + kg;
      }
    }

    totalKg = round(totalKg);
    const totalTonnes = round(totalKg / 1000, 4);

    const categoryBreakdown = Object.entries(catMap).map(([category, kg]) => ({
      category,
      emissionsKg: round(kg),
      emissionsTonnes: round(kg / 1000, 4),
      percentage: totalKg > 0 ? round((kg / totalKg) * 100, 1) : 0,
    }));

    const scopeBreakdown = Object.entries(scopeMap).map(([scope, kg]) => ({
      scope,
      emissionsKg: round(kg),
      emissionsTonnes: round(kg / 1000, 4),
      percentage: totalKg > 0 ? round((kg / totalKg) * 100, 1) : 0,
    }));

    res.json({
      totals: {
        emissionsKg: totalKg,
        emissionsTonnes: totalTonnes,
        activityCount: rows.length,
      },
      categoryBreakdown,
      scopeBreakdown,
      standards: {
        methodology: 'GHG Protocol Corporate Accounting and Reporting Standard / DEFRA 2024',
        massUnits: ['kg CO2e', 'tonnes CO2e'],
        avoidedDoubleCountingPrinciples: [
          'Passenger vehicle emissions allocated proportionately across all riders.',
          'On-site rooftop solar self-consumption deducted from gross grid consumption.',
          'Separation of Scope 1 direct combustion and Scope 2 purchased electricity.',
        ],
        verificationStatus: 'Modeled estimates based on peer-reviewed and government conversion factors.',
      },
    });
  } catch (error) {
    console.error('Get Summary Error:', error);
    res.status(500).json({ message: 'Error retrieving emission summary' });
  }
};

// @desc    Get connected calculation record for an activity log
// @route   GET /api/emissions/activity/:activityId
const getActivityEmission = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT e.*, a.activity_type, a.date as activity_date
       FROM activity_emissions e
       JOIN activities a ON a.id = e.activity_id
       WHERE e.activity_id = $1 AND e.user_id = $2`,
      [req.params.activityId, req.user.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'No connected emission record found for this activity.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get Activity Emission Error:', error);
    res.status(500).json({ message: 'Error retrieving activity emission record' });
  }
};

module.exports = {
  getFactors,
  calculate,
  getSummary,
  getActivityEmission,
};

