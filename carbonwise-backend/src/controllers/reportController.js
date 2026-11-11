const db = require('../config/db');
const PDFDocument = require('pdfkit');
const {
  generateReportNarrative,
  generateInsightsNarrative,
  generatePredictionNarrative,
} = require('../services/geminiChatService');
const reportAnalyticsService = require('../services/reportAnalyticsService');

const summarize = (activities) => {
  const byType = {};
  activities.forEach((activity) => {
    byType[activity.activity_type] = (byType[activity.activity_type] || 0) + (parseFloat(activity.carbon_emissions) || 0);
  });
  return {
    totalEmissions: activities.reduce((sum, activity) => sum + (parseFloat(activity.carbon_emissions) || 0), 0),
    byType,
    activityCount: activities.length,
  };
};

const generateReport = async (req, res) => {
  try {
    const result = await db.query('SELECT activity_type, details, carbon_emissions, date FROM activities WHERE user_id = $1 ORDER BY date DESC LIMIT 30', [req.user.id]);
    if (!result.rows.length) return res.status(400).json({ message: 'No activities found. Log some activities first to generate a report.' });
    const summary = summarize(result.rows);
    const report = await generateReportNarrative(summary, { userId: req.user.id, dataVersion: `activities-${result.rows[0].date}-${result.rows.length}` });
    res.json({ report, totalEmissions: summary.totalEmissions.toFixed(2), byType: summary.byType, activityCount: summary.activityCount });
  } catch (error) {
    console.error('Report Error:', error);
    res.json({ report: 'Unable to generate the AI report right now. Based on your activities, focus on reducing your highest recorded emission categories.' });
  }
};

const generateInsights = async (req, res) => {
  try {
    const result = await db.query('SELECT activity_type, details, carbon_emissions, date FROM activities WHERE user_id = $1 ORDER BY date DESC LIMIT 20', [req.user.id]);
    if (!result.rows.length) return res.json({ insights: [] });
    const summary = summarize(result.rows);
    const raw = await generateInsightsNarrative({
      totalEmissions: summary.totalEmissions.toFixed(2),
      byType: summary.byType,
      activityCount: summary.activityCount,
      activities: result.rows.map(({ activity_type, details, carbon_emissions }) => ({ activity_type, details, carbon_emissions })),
    }, { userId: req.user.id, dataVersion: `activities-${result.rows[0].date}-${result.rows.length}` });
    let insights = [];
    try {
      const parsed = JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0] || raw);
      if (Array.isArray(parsed)) {
        insights = parsed.filter((item) => item && typeof item.title === 'string' && typeof item.description === 'string'
          && ['high', 'medium', 'low'].includes(item.impact)).slice(0, 5);
      }
    } catch (error) {
      console.warn('Insights output validation failed; returning empty insights.');
    }
    res.json({ insights, totalEmissions: summary.totalEmissions.toFixed(2) });
  } catch (error) {
    console.error('Insights Error:', error);
    res.status(500).json({ message: 'Error generating insights' });
  }
};

const generatePrediction = async (req, res) => {
  try {
    const result = await db.query('SELECT carbon_emissions, date FROM activities WHERE user_id = $1 ORDER BY date DESC LIMIT 30', [req.user.id]);
    if (result.rows.length < 5) return res.json({ prediction: 'Need at least 5 logged activities for an explanatory estimate.' });
    const total = result.rows.reduce((sum, activity) => sum + (parseFloat(activity.carbon_emissions) || 0), 0);
    const avgDaily = (total / result.rows.length).toFixed(2);
    const predictedMonthly = (Number(avgDaily) * 30).toFixed(2);
    const prediction = await generatePredictionNarrative({ avgDaily, predictedMonthly, activityCount: result.rows.length }, { userId: req.user.id, dataVersion: `activities-${result.rows[0].date}-${result.rows.length}` });
    res.json({ prediction, avgDaily, predictedMonthly });
  } catch (error) {
    console.error('Prediction Error:', error);
    res.json({ prediction: 'The deterministic estimate is temporarily unavailable. Review transport, electricity, and food emissions when choosing your next action.' });
  }
};

const generatePDFReport = async (req, res) => {
  try {
    const { filter = '30d', startDate, endDate } = req.query;
    await reportAnalyticsService.generatePDF(req.user.id, { filter, startDate, endDate }, res);
  } catch (error) {
    console.error('PDF Report Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error generating PDF report' });
    }
  }
};

const getDetailedReportController = async (req, res) => {
  try {
    const { filter = '30d', startDate, endDate } = req.query;
    const report = await reportAnalyticsService.getDetailedReport(req.user.id, {
      filter,
      startDate,
      endDate,
    });
    res.json(report);
  } catch (error) {
    console.error('Detailed Report Error:', error);
    res.status(500).json({ message: 'Error generating detailed emissions report' });
  }
};

const downloadCSVController = async (req, res) => {
  try {
    const { filter = '30d', startDate, endDate } = req.query;
    const csvContent = await reportAnalyticsService.generateCSV(req.user.id, {
      filter,
      startDate,
      endDate,
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="carbonwise-emissions-report-${filter}.csv"`
    );
    res.send(csvContent);
  } catch (error) {
    console.error('CSV Report Error:', error);
    res.status(500).json({ message: 'Error exporting CSV report' });
  }
};

const getMonthlySustainabilityController = async (req, res) => {
  try {
    const { month } = req.query;
    const report = await reportAnalyticsService.getMonthlySustainabilityReport(req.user.id, month);
    res.json(report);
  } catch (error) {
    console.error('Monthly Sustainability Report Error:', error);
    res.status(500).json({ message: 'Error generating monthly sustainability report' });
  }
};

module.exports = {
  generateReport,
  generateInsights,
  generatePrediction,
  generatePDFReport,
  getDetailedReport: getDetailedReportController,
  downloadCSV: downloadCSVController,
  getMonthlySustainability: getMonthlySustainabilityController,
};
