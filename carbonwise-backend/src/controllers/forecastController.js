const db = require('../config/db');
const { buildForecast, getForecastConfig } = require('../services/carbonForecastService');
const { getPeriodBounds } = require('../services/carbonIntelligenceService');
const { generatePredictionNarrative } = require('../services/geminiChatService');

const getForecast = async (req, res) => {
  try {
    const { periodDays, horizonDays } = getForecastConfig({
      periodDays: req.query.period,
      horizonDays: req.query.horizon,
    });

    // Check for What-If scenario query params
    let whatIfReductions = null;
    if (
      req.query.simElectricity !== undefined ||
      req.query.simTransport !== undefined ||
      req.query.simFood !== undefined ||
      req.query.simWaste !== undefined
    ) {
      whatIfReductions = {
        electricityPct: Number(req.query.simElectricity || 0),
        transportPct: Number(req.query.simTransport || 0),
        foodPct: Number(req.query.simFood || 0),
        wastePct: Number(req.query.simWaste || 0),
        otherPct: Number(req.query.simOther || 0),
      };
    }

    const result = await db.query(
      `SELECT id, activity_type, details, carbon_emissions, TO_CHAR(date, 'YYYY-MM-DD') as date
       FROM activities
       WHERE user_id = $1
       ORDER BY date ASC, id ASC`,
      [req.user.id]
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

    const forecastData = buildForecast({
      activities: result.rows,
      startDate: bounds.currentStart,
      endDate: bounds.currentEnd,
      periodDays,
      horizonDays,
      whatIfReductions,
    });

    // Generate Gemini explanation strictly explaining the deterministic forecast
    try {
      if (forecastData.forecast.sufficientData) {
        const summaryForAi = {
          horizonDays,
          baselineDailyAverage: forecastData.forecast.baselineDailyAverage,
          totalProjectedKg: forecastData.forecast.totalProjectedKg,
          topFutureContributor: forecastData.outlooks?.topFutureContributor?.label || 'General activities',
          topFutureShare: forecastData.outlooks?.topFutureContributor?.shareOfFuture || 0,
          anomaliesDetected: forecastData.anomalies.length,
          activityCount: forecastData.dataQuality.activityCount,
        };

        const aiNarrative = await generatePredictionNarrative(summaryForAi, {
          userId: req.user.id,
          dataVersion: `forecast-${horizonDays}-${forecastData.dataQuality.activityCount}-${forecastData.forecast.totalProjectedKg}`,
        });

        forecastData.explanation.aiNarrative = aiNarrative;
      } else {
        forecastData.explanation.aiNarrative = forecastData.forecast.limitation;
      }
    } catch (aiErr) {
      console.warn('Gemini prediction explanation fallback used:', aiErr.message);
      forecastData.explanation.aiNarrative =
        'Projections are calculated based on your recent activity patterns. Maintain consistent daily tracking across transport, electricity, and diet to improve statistical confidence.';
    }

    res.json(forecastData);
  } catch (error) {
    console.error('Carbon forecast error:', error);
    res.status(500).json({ message: 'Unable to calculate carbon forecast.' });
  }
};

const simulateForecastScenario = async (req, res) => {
  try {
    const { periodDays, horizonDays } = getForecastConfig({
      periodDays: req.body.period || req.query.period,
      horizonDays: req.body.horizon || req.query.horizon,
    });

    const whatIfReductions = {
      electricityPct: Number(req.body.electricityPct || 0),
      transportPct: Number(req.body.transportPct || 0),
      foodPct: Number(req.body.foodPct || 0),
      wastePct: Number(req.body.wastePct || 0),
      otherPct: Number(req.body.otherPct || 0),
    };

    const result = await db.query(
      `SELECT id, activity_type, details, carbon_emissions, TO_CHAR(date, 'YYYY-MM-DD') as date
       FROM activities
       WHERE user_id = $1
       ORDER BY date ASC, id ASC`,
      [req.user.id]
    );

    const todayIso = new Date().toISOString().slice(0, 10);
    const bounds = getPeriodBounds(periodDays, todayIso);

    const forecastData = buildForecast({
      activities: result.rows,
      startDate: bounds.currentStart,
      endDate: bounds.currentEnd,
      periodDays,
      horizonDays,
      whatIfReductions,
    });

    res.json(forecastData.scenarioSimulation || { isHypothetical: true, potentialSavingsKg: 0 });
  } catch (error) {
    console.error('Simulate forecast error:', error);
    res.status(500).json({ message: 'Unable to simulate reduction scenario.' });
  }
};

module.exports = { getForecast, simulateForecastScenario };
