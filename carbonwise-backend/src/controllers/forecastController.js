const db = require('../config/db');
const { buildForecast, getForecastConfig } = require('../services/carbonForecastService');
const { getPeriodBounds } = require('../services/carbonIntelligenceService');

const getForecast = async (req, res) => {
  try {
    const { periodDays, horizonDays } = getForecastConfig({
      periodDays: req.query.period,
      horizonDays: req.query.horizon,
    });
    const result = await db.query(
      `SELECT id, activity_type, details, carbon_emissions, date
       FROM activities
       WHERE user_id = $1
       ORDER BY date ASC, id ASC`,
      [req.user.id],
    );

    let referenceToday;
    if (result.rows.length > 0) {
      const dates = result.rows
        .map((r) => (r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10)))
        .filter(Boolean)
        .sort();
      const latestDate = dates[dates.length - 1];
      const todayIso = new Date().toISOString().slice(0, 10);
      const defaultBounds = getPeriodBounds(periodDays, todayIso);
      if (latestDate < defaultBounds.currentStart) {
        referenceToday = latestDate;
      }
    }

    const bounds = getPeriodBounds(periodDays, referenceToday);
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
