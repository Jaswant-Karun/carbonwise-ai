const db = require('../config/db');
const { buildIntelligence, getPeriodBounds } = require('../services/carbonIntelligenceService');

const allowedPeriods = new Set([7, 30, 90, 365]);

const getCarbonIntelligence = async (req, res) => {
  const requestedPeriod = Number.parseInt(req.query.period, 10);
  const periodDays = allowedPeriods.has(requestedPeriod) ? requestedPeriod : 30;

  try {
    const activitiesResult = await db.query(
      `SELECT activity_type, details, carbon_emissions, date
       FROM activities
       WHERE user_id = $1
       ORDER BY date ASC`,
      [req.user.id]
    );

    let referenceToday;
    if (activitiesResult.rows.length > 0) {
      const dates = activitiesResult.rows
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
