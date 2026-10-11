const db = require('../config/db');
const { buildIntelligence, getPeriodBounds } = require('../services/carbonIntelligenceService');

const allowedPeriods = new Set([7, 30, 90, 365]);

const getCarbonIntelligence = async (req, res) => {
  const requestedPeriod = Number.parseInt(req.query.period, 10);
  const periodDays = allowedPeriods.has(requestedPeriod) ? requestedPeriod : 30;
  const bounds = getPeriodBounds(periodDays);

  try {
    const activitiesResult = await db.query(
      `SELECT activity_type, details, carbon_emissions, date
       FROM activities
       WHERE user_id = $1
         AND date BETWEEN $2::date AND $3::date
       ORDER BY date ASC`,
      [req.user.id, bounds.previousStart, bounds.currentEnd]
    );

    const intelligence = buildIntelligence({
      activities: activitiesResult.rows,
      periodDays,
      ...bounds,
    });

    res.json(intelligence);
  } catch (error) {
    console.error('Carbon intelligence error:', error);
    res.status(500).json({ message: 'Unable to calculate carbon intelligence' });
  }
};

module.exports = { getCarbonIntelligence };
