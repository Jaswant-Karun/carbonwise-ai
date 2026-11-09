const db = require('../config/db');
const { buildCoachPlan, validateActions, validateGoal, validateStatus } = require('../services/ecoCoachService');
const { generateCoachNarrative } = require('../services/geminiChatService');

const sendError = (res, error, fallback) => {
  const isClientError = Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode < 500;
  console.error(fallback, error.code || error.name || 'unknown');
  res.status(isClientError ? error.statusCode : 500).json({ message: isClientError ? error.message : fallback });
};

const getActivities = async (userId) => {
  const result = await db.query(
    `SELECT activity_type, details, carbon_emissions, date
     FROM activities WHERE user_id = $1 ORDER BY date ASC`,
    [userId],
  );
  return result.rows;
};

const getCompletedActions = async (userId) => {
  const result = await db.query(
    `SELECT category, title, completed_at FROM coach_actions
     WHERE user_id = $1 AND status = 'completed'
     ORDER BY completed_at DESC LIMIT 50`,
    [userId],
  );
  return result.rows;
};

const serializeAction = (row) => ({
  id: row.id,
  dayNumber: row.day_number,
  category: row.category,
  title: row.title,
  explanation: row.explanation,
  suggestedTarget: row.suggested_target,
  estimatedPotentialSavingsKg: row.estimated_potential_savings_kg == null ? null : Number(row.estimated_potential_savings_kg),
  status: row.status,
  completedAt: row.completed_at,
});

const serializePlan = (row, actions) => ({
  id: row.id,
  periodDays: row.period_days,
  narrative: row.narrative,
  narrativeSource: row.narrative_source,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  actions: actions.map(serializeAction),
});

const createPlan = async (req, res) => {
  try {
    const activities = await getActivities(req.user.id);
    const completedHistory = await getCompletedActions(req.user.id);
    const plan = buildCoachPlan({ activities, completedHistory });
    let narrative = null;
    let narrativeSource = 'deterministic';

    if (req.body.useGemini === true) {
      try {
        narrative = await generateCoachNarrative({
          categories: plan.highestImpactCategories.map((category) => category.label),
          actions: plan.actions,
        }, { userId: req.user.id, dataVersion: `plan-${plan.activityCount}-${plan.invalidActivityCount}` });
        if (typeof narrative !== 'string' || narrative.length < 1 || narrative.length > 800) {
          throw new Error('Gemini narrative failed validation.');
        }
        narrativeSource = 'gemini';
      } catch (error) {
        console.warn('Gemini coach narrative unavailable; using deterministic fallback:', error.message);
      }
    }

    const planResult = await db.query(
      `INSERT INTO coach_plans (user_id, period_days, narrative, narrative_source)
       VALUES ($1, 7, $2, $3) RETURNING *`,
      [req.user.id, narrative, narrativeSource],
    );
    const planRow = planResult.rows[0];

    for (const action of plan.actions) {
      await db.query(
        `INSERT INTO coach_actions
          (plan_id, user_id, day_number, category, title, explanation, suggested_target, estimated_potential_savings_kg)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [planRow.id, req.user.id, action.dayNumber, action.category, action.title, action.explanation,
          action.suggestedTarget, action.estimatedPotentialSavingsKg],
      );
    }

    const actionResult = await db.query('SELECT * FROM coach_actions WHERE plan_id = $1 ORDER BY day_number ASC', [planRow.id]);
    res.status(201).json({
      ...serializePlan(planRow, actionResult.rows),
      highestImpactCategories: plan.highestImpactCategories,
      activityCount: plan.activityCount,
      invalidActivityCount: plan.invalidActivityCount,
      isEstimate: true,
    });
  } catch (error) {
    sendError(res, error, 'Unable to create coach plan');
  }
};

const getPlans = async (req, res) => {
  try {
    const plans = await db.query('SELECT * FROM coach_plans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20', [req.user.id]);
    const result = [];
    for (const plan of plans.rows) {
      const actions = await db.query('SELECT * FROM coach_actions WHERE plan_id = $1 AND user_id = $2 ORDER BY day_number ASC', [plan.id, req.user.id]);
      result.push(serializePlan(plan, actions.rows));
    }
    res.json(result);
  } catch (error) {
    sendError(res, error, 'Unable to fetch coach plans');
  }
};

const getPlan = async (req, res) => {
  try {
    const plan = await db.query('SELECT * FROM coach_plans WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!plan.rows[0]) return res.status(404).json({ message: 'Coach plan not found.' });
    const actions = await db.query('SELECT * FROM coach_actions WHERE plan_id = $1 AND user_id = $2 ORDER BY day_number ASC', [req.params.id, req.user.id]);
    res.json(serializePlan(plan.rows[0], actions.rows));
  } catch (error) {
    sendError(res, error, 'Unable to fetch coach plan');
  }
};

const updateAction = async (req, res) => {
  try {
    const status = validateStatus(req.body.status);
    const result = await db.query(
      `UPDATE coach_actions
       SET status = $1::varchar, completed_at = CASE WHEN $1::varchar = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE id = $2 AND user_id = $3 RETURNING *`,
      [status, req.params.actionId, req.user.id],
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Coach action not found.' });
    res.json(serializeAction(result.rows[0]));
  } catch (error) {
    sendError(res, error, 'Unable to update coach action');
  }
};

const getGoals = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT g.*, COALESCE(SUM(CASE WHEN a.status = 'completed' AND a.created_at >= g.started_at THEN 1 ELSE 0 END), 0)::int AS completed_actions
       FROM coach_goals g LEFT JOIN coach_actions a ON a.user_id = g.user_id
       WHERE g.user_id = $1 GROUP BY g.id ORDER BY g.created_at DESC`,
      [req.user.id],
    );
    res.json(result.rows.map((goal) => ({ ...goal, targetKg: Number(goal.target_kg), baselineKg: Number(goal.baseline_kg), completedActions: goal.completed_actions })));
  } catch (error) {
    sendError(res, error, 'Unable to fetch coach goals');
  }
};

const createGoal = async (req, res) => {
  try {
    const input = validateGoal(req.body);
    const activities = await getActivities(req.user.id);
    const plan = buildCoachPlan({ activities });
    const categoryBaseline = input.category
      ? plan.highestImpactCategories.find((item) => item.category === input.category)?.emissionsKg || 0
      : plan.highestImpactCategories.reduce((total, item) => total + item.emissionsKg, 0);
    const result = await db.query(
      `INSERT INTO coach_goals (user_id, period, category, target_kg, baseline_kg)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, input.period, input.category, input.targetKg, categoryBaseline],
    );
    const goal = result.rows[0];
    res.status(201).json({ ...goal, targetKg: Number(goal.target_kg), baselineKg: Number(goal.baseline_kg), completedActions: 0 });
  } catch (error) {
    sendError(res, error, 'Unable to create coach goal');
  }
};

const updateGoal = async (req, res) => {
  try {
    const status = ['active', 'completed', 'archived'].includes(req.body.status) ? req.body.status : null;
    if (!status) return res.status(400).json({ message: 'Invalid goal status.' });
    const result = await db.query(
      `UPDATE coach_goals SET status = $1, completed_at = CASE WHEN $1 = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END,
       updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 RETURNING *`,
      [status, req.params.id, req.user.id],
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Coach goal not found.' });
    const goal = result.rows[0];
    res.json({ ...goal, targetKg: Number(goal.target_kg), baselineKg: Number(goal.baseline_kg) });
  } catch (error) {
    sendError(res, error, 'Unable to update coach goal');
  }
};

module.exports = { createGoal, createPlan, getGoals, getPlan, getPlans, updateAction, updateGoal };
