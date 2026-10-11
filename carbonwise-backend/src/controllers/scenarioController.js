const db = require('../config/db');
const { calculateScenario, validatePeriodDays } = require('../services/whatIfSimulatorService');

const getActivitiesForUser = async (userId, periodDays) => {
  const result = await db.query(
    `SELECT activity_type, details, carbon_emissions, date
     FROM activities
     WHERE user_id = $1
       AND date >= CURRENT_DATE - ($2::integer - 1)
       AND date <= CURRENT_DATE
     ORDER BY date ASC`,
    [userId, periodDays],
  );
  return result.rows;
};

const getScenarioInput = (body) => ({
  periodDays: validatePeriodDays(body.periodDays),
  changes: body.changes,
});

const buildScenarioResult = async (userId, input) => {
  const activities = await getActivitiesForUser(userId, input.periodDays);
  return calculateScenario({ activities, ...input });
};

const sendError = (res, error, fallback) => {
  console.error(fallback, error);
  res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : fallback });
};

const previewScenario = async (req, res) => {
  try {
    res.json(await buildScenarioResult(req.user.id, getScenarioInput(req.body)));
  } catch (error) {
    sendError(res, error, 'Server error calculating scenario');
  }
};

const createScenario = async (req, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 120) {
      return res.status(400).json({ message: 'name is required and must be 120 characters or fewer.' });
    }
    const input = getScenarioInput(req.body);
    const result = await buildScenarioResult(req.user.id, input);
    const saved = await db.query(
      `INSERT INTO scenarios
        (user_id, name, period_days, changes, baseline_emissions, scenario_emissions,
         potential_savings_kg, potential_savings_percentage, assumptions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.user.id, name, input.periodDays, JSON.stringify(result.changes), result.baselineEmissionsKg,
        result.scenarioEmissionsKg, result.potentialSavingsKg, result.potentialSavingsPercentage,
        JSON.stringify(result.assumptions)],
    );
    res.status(201).json({ ...result, id: saved.rows[0].id, name: saved.rows[0].name, createdAt: saved.rows[0].created_at });
  } catch (error) {
    sendError(res, error, 'Server error saving scenario');
  }
};

const serializeScenario = (row) => ({
  id: row.id,
  name: row.name,
  periodDays: row.period_days,
  changes: row.changes,
  baselineEmissionsKg: Number(row.baseline_emissions),
  scenarioEmissionsKg: Number(row.scenario_emissions),
  potentialSavingsKg: Number(row.potential_savings_kg),
  potentialSavingsPercentage: Number(row.potential_savings_percentage),
  assumptions: row.assumptions,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  isEstimate: true,
});

const getScenarios = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM scenarios WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json(result.rows.map(serializeScenario));
  } catch (error) {
    sendError(res, error, 'Server error fetching scenarios');
  }
};

const getScenario = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM scenarios WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ message: 'Scenario not found.' });
    res.json(serializeScenario(result.rows[0]));
  } catch (error) {
    sendError(res, error, 'Server error fetching scenario');
  }
};

const updateScenario = async (req, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 120) return res.status(400).json({ message: 'name is required and must be 120 characters or fewer.' });
    const input = getScenarioInput(req.body);
    const result = await buildScenarioResult(req.user.id, input);
    const updated = await db.query(
      `UPDATE scenarios
       SET name = $1, period_days = $2, changes = $3, baseline_emissions = $4,
           scenario_emissions = $5, potential_savings_kg = $6,
           potential_savings_percentage = $7, assumptions = $8, updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 AND user_id = $10
       RETURNING *`,
      [name, input.periodDays, JSON.stringify(result.changes), result.baselineEmissionsKg, result.scenarioEmissionsKg,
        result.potentialSavingsKg, result.potentialSavingsPercentage, JSON.stringify(result.assumptions),
        req.params.id, req.user.id],
    );
    if (!updated.rows[0]) return res.status(404).json({ message: 'Scenario not found.' });
    res.json(serializeScenario(updated.rows[0]));
  } catch (error) {
    sendError(res, error, 'Server error updating scenario');
  }
};

const deleteScenario = async (req, res) => {
  try {
    const result = await db.query('DELETE FROM scenarios WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ message: 'Scenario not found.' });
    res.status(204).send();
  } catch (error) {
    sendError(res, error, 'Server error deleting scenario');
  }
};

const compareScenarios = async (req, res) => {
  try {
    if (!Array.isArray(req.body.ids) || req.body.ids.length < 2 || req.body.ids.length > 10) {
      return res.status(400).json({ message: 'Provide between 2 and 10 scenario ids to compare.' });
    }
    const result = await db.query('SELECT * FROM scenarios WHERE user_id = $1 AND id = ANY($2::int[]) ORDER BY created_at DESC', [req.user.id, req.body.ids]);
    res.json(result.rows.map(serializeScenario));
  } catch (error) {
    sendError(res, error, 'Server error comparing scenarios');
  }
};

module.exports = {
  compareScenarios,
  createScenario,
  deleteScenario,
  getScenario,
  getScenarios,
  previewScenario,
  updateScenario,
};
