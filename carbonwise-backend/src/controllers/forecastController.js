const db = require('../config/db');
const { buildForecast, getForecastConfig } = require('../services/carbonForecastService');
const { getPeriodBounds } = require('../services/carbonIntelligenceService');

const getForecast = async (req, res) => {
  try {
    const { periodDays, horizonDays } = getForecastConfig({
      periodDays: req.query.period,
      horizonDays: req.query.horizon,
    });
    const bounds = getPeriodBounds(periodDays);
    const result = await db.query(
      `SELECT id, activity_type, details, carbon_emissions, date
       FROM activities
       WHERE user_id = $1 AND date BETWEEN $2::date AND $3::date
       ORDER BY date ASC, id ASC`,
      [req.user.id, bounds.currentStart, bounds.currentEnd],
    );
    res.json(buildForecast({
      activities: result.rows,
      startDate: bounds.currentStart,
      endDate: bounds.currentEnd,
      periodDays,
      horizonDays,
    }));
  } catch (error) {
    console.error('Carbon forecast error:', error);
    res.status(500).json({ message: 'Unable to calculate carbon forecast.' });
  }
};

module.exports = { getForecast };
