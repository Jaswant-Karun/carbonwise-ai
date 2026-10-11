const PDFDocument = require('pdfkit');
const db = require('../config/db');
const { buildImpactReport, validateBaseline, normalizePeriod } = require('../services/impactTrackerService');
const { generateImpactNarrative } = require('../services/geminiChatService');

const sendError = (res, error, fallback) => {
  console.error(fallback, error);
  res.status(error.statusCode || 400).json({ message: error.message || fallback });
};

const getActivities = async (userId) => {
  const result = await db.query('SELECT id, activity_type, details, carbon_emissions, date FROM activities WHERE user_id = $1 ORDER BY date ASC, id ASC', [userId]);
  return result.rows;
};

const getBaseline = async (userId, id) => {
  const result = await db.query('SELECT * FROM impact_baselines WHERE id = $1 AND user_id = $2', [id, userId]);
  return result.rows[0] || null;
};

const addProgressData = async (userId, report) => {
  const goals = await db.query(
    `SELECT g.*, COALESCE(SUM(CASE WHEN a.status = 'completed' AND a.created_at >= g.started_at THEN 1 ELSE 0 END), 0)::int AS completed_actions
     FROM coach_goals g LEFT JOIN coach_actions a ON a.user_id = g.user_id
     WHERE g.user_id = $1 GROUP BY g.id ORDER BY g.created_at DESC`,
    [userId],
  );
  const actions = await db.query(
    `SELECT id, category, title, status, completed_at, created_at FROM coach_actions
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [userId],
  );
  return {
    ...report,
    goals: goals.rows.map((goal) => ({
      id: goal.id, period: goal.period, category: goal.category, targetKg: Number(goal.target_kg),
      baselineKg: Number(goal.baseline_kg), status: goal.status, completedActions: goal.completed_actions,
    })),
    actionHistory: actions.rows,
  };
};

const createBaseline = async (req, res) => {
  try {
    const input = validateBaseline(req.body);
    const activities = await getActivities(req.user.id);
    const baselineTotal = buildImpactReport({
      activities,
      currentPeriod: input.periodDays,
      baseline: { startDate: input.startDate, endDate: input.endDate },
    }).totals.baseline;
    const name = typeof req.body.name === 'string' && req.body.name.trim() ? req.body.name.trim().slice(0, 120) : `Baseline ${input.startDate} to ${input.endDate}`;
    const result = await db.query(
      `INSERT INTO impact_baselines (user_id, name, period_days, start_date, end_date, total_emissions)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, name, input.periodDays, input.startDate, input.endDate, baselineTotal],
    );
    const row = result.rows[0];
    res.status(201).json({ id: row.id, name: row.name, periodDays: row.period_days, startDate: row.start_date, endDate: row.end_date, totalEmissions: Number(row.total_emissions), createdAt: row.created_at });
  } catch (error) {
    sendError(res, error, 'Unable to create baseline');
  }
};

const getBaselines = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM impact_baselines WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json(result.rows.map((row) => ({ id: row.id, name: row.name, periodDays: row.period_days, startDate: row.start_date, endDate: row.end_date, totalEmissions: Number(row.total_emissions), createdAt: row.created_at })));
  } catch (error) {
    sendError(res, error, 'Unable to fetch baselines');
  }
};

const createReport = async (req, res) => {
  try {
    const periodDays = normalizePeriod(req.body.periodDays);
    const baseline = req.body.baselineId ? await getBaseline(req.user.id, req.body.baselineId) : null;
    if (req.body.baselineId && !baseline) return res.status(404).json({ message: 'Baseline not found.' });
    const activities = await getActivities(req.user.id);
    let report = buildImpactReport({ activities, currentPeriod: periodDays, baseline });
    report = await addProgressData(req.user.id, report);
    let narrative = null;
    let narrativeSource = 'deterministic';
    if (req.body.useGemini === true) {
      try {
        narrative = await generateImpactNarrative(report);
        if (typeof narrative !== 'string' || narrative.length < 1 || narrative.length > 1200) throw new Error('Narrative failed validation.');
        narrativeSource = 'gemini';
      } catch (error) {
        console.warn('Impact narrative unavailable; using deterministic report:', error.message);
      }
    }
    const saved = await db.query(
      `INSERT INTO impact_reports (user_id, baseline_id, period_days, report_month, report_data, narrative, narrative_source)
       VALUES ($1, $2, $3, DATE_TRUNC('month', CURRENT_DATE), $4, $5, $6) RETURNING *`,
      [req.user.id, baseline?.id || null, periodDays, JSON.stringify(report), narrative, narrativeSource],
    );
    const row = saved.rows[0];
    res.status(201).json({ id: row.id, createdAt: row.created_at, narrative, narrativeSource, ...report });
  } catch (error) {
    sendError(res, error, 'Unable to generate impact report');
  }
};

const getReports = async (req, res) => {
  try {
    const result = await db.query('SELECT id, baseline_id, period_days, report_month, report_data, narrative, narrative_source, created_at FROM impact_reports WHERE user_id = $1 ORDER BY created_at DESC LIMIT 24', [req.user.id]);
    res.json(result.rows.map((row) => ({ id: row.id, baselineId: row.baseline_id, periodDays: row.period_days, reportMonth: row.report_month, createdAt: row.created_at, narrative: row.narrative, narrativeSource: row.narrative_source, ...row.report_data })));
  } catch (error) {
    sendError(res, error, 'Unable to fetch impact reports');
  }
};

const exportReportPdf = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM impact_reports WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ message: 'Impact report not found.' });
    const row = result.rows[0];
    const report = row.report_data;
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=impact-report-${row.id}.pdf`);
    doc.pipe(res);
    doc.fontSize(20).text('CarbonWise Sustainability Impact Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(11).text(`Generated: ${new Date(row.created_at).toLocaleDateString()}`);
    doc.text(`Current period: ${report.period.currentStart} to ${report.period.currentEnd}`);
    doc.text(`Current emissions: ${report.totals.current.toFixed(2)} kg CO2`);
    doc.text(`Baseline emissions: ${report.totals.baseline.toFixed(2)} kg CO2`);
    doc.text(`Observed change: ${report.totals.status} (${report.totals.percentageChange == null ? 'new baseline' : `${report.totals.percentageChange}%`})`);
    doc.moveDown().fontSize(14).text('Category breakdown', { underline: true });
    report.categoryBreakdown.forEach((item) => doc.fontSize(11).text(`- ${item.label}: ${item.emissions.toFixed(2)} kg CO2`));
    doc.moveDown().fontSize(14).text('Interpretation', { underline: true });
    doc.fontSize(11).text(report.limitations);
    doc.end();
  } catch (error) {
    sendError(res, error, 'Unable to export impact report');
  }
};

module.exports = { createBaseline, createReport, exportReportPdf, getBaselines, getReports };
