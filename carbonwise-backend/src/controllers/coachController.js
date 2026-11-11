const db = require('../config/db');
const {
  buildCoachPlan,
  evaluateGoalProgress,
  generateAllRecommendations,
  validateActions,
  validateGoal,
  validateStatus,
} = require('../services/ecoCoachService');
const { generateCoachNarrative } = require('../services/geminiChatService');

const sendError = (res, error, fallback) => {
  const isClientError = Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode < 500;
  console.error(fallback, error.code || error.name || 'unknown');
  res.status(isClientError ? error.statusCode : 500).json({ message: isClientError ? error.message : fallback });
};

const getActivities = async (userId) => {
  const result = await db.query(
    `SELECT id, activity_type, details, carbon_emissions, TO_CHAR(date, 'YYYY-MM-DD') as date
     FROM activities WHERE user_id = $1 ORDER BY date ASC, id ASC`,
    [userId],
  );
  return result.rows;
};

const getCompletedActions = async (userId) => {
  const result = await db.query(
    `SELECT category, title, completed_at, estimated_potential_savings_kg FROM coach_actions
     WHERE user_id = $1 AND status = 'completed'
     ORDER BY completed_at DESC LIMIT 100`,
    [userId],
  );
  return result.rows;
};

const serializeAction = (row) => ({
  id: row.id,
  planId: row.plan_id,
  dayNumber: row.day_number,
  category: row.category,
  actionType: row.action_type || `${row.category}_action`,
  title: row.title,
  explanation: row.explanation,
  suggestedTarget: row.suggested_target,
  estimatedPotentialSavingsKg: row.estimated_potential_savings_kg == null ? null : Number(row.estimated_potential_savings_kg),
  estimatedPotentialSavingsTonnes: row.estimated_potential_savings_kg == null ? null : Number((Number(row.estimated_potential_savings_kg) / 1000.0).toFixed(4)),
  impactLevel: row.impact_level || 'high',
  reason: row.reason || `Recommended based on your activity pattern in ${row.category}.`,
  savingsCalculation: row.savings_calculation || 'Documented calculation based on standard reduction factors.',
  status: row.status,
  completedAt: row.completed_at,
  createdAt: row.created_at,
});

const serializePlan = (row, actions, recommendations = []) => ({
  id: row.id,
  periodDays: row.period_days,
  narrative: row.narrative,
  narrativeSource: row.narrative_source,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  actions: actions.map(serializeAction),
  recommendations,
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
          (plan_id, user_id, day_number, category, title, explanation, suggested_target,
           estimated_potential_savings_kg, action_type, impact_level, reason, savings_calculation, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          planRow.id,
          req.user.id,
          action.dayNumber,
          action.category,
          action.title,
          action.explanation,
          action.suggestedTarget,
          action.estimatedPotentialSavingsKg,
          action.actionType || `${action.category}_action`,
          action.impactLevel || 'high',
          action.reason || 'Recommended based on activity analysis.',
          action.savingsCalculation || 'Documented formula based on standard factors.',
          action.status || 'planned',
        ],
      );
    }

    const actionResult = await db.query('SELECT * FROM coach_actions WHERE plan_id = $1 ORDER BY day_number ASC', [planRow.id]);
    res.status(201).json({
      ...serializePlan(planRow, actionResult.rows, plan.recommendations),
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
    const activities = await getActivities(req.user.id);
    const completedHistory = await getCompletedActions(req.user.id);
    const freshPlan = buildCoachPlan({ activities, completedHistory });

    const plans = await db.query('SELECT * FROM coach_plans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20', [req.user.id]);
    const result = [];
    for (const plan of plans.rows) {
      const actions = await db.query('SELECT * FROM coach_actions WHERE plan_id = $1 AND user_id = $2 ORDER BY day_number ASC', [plan.id, req.user.id]);
      result.push(serializePlan(plan, actions.rows, freshPlan.recommendations));
    }

    if (result.length === 0) {
      const planResult = await db.query(
        `INSERT INTO coach_plans (user_id, period_days, narrative, narrative_source)
         VALUES ($1, 7, NULL, 'deterministic') RETURNING *`,
        [req.user.id],
      );
      const planRow = planResult.rows[0];
      for (const action of freshPlan.actions) {
        await db.query(
          `INSERT INTO coach_actions
            (plan_id, user_id, day_number, category, title, explanation, suggested_target,
             estimated_potential_savings_kg, action_type, impact_level, reason, savings_calculation, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            planRow.id,
            req.user.id,
            action.dayNumber,
            action.category,
            action.title,
            action.explanation,
            action.suggestedTarget,
            action.estimatedPotentialSavingsKg,
            action.actionType || `${action.category}_action`,
            action.impactLevel || 'high',
            action.reason || 'Recommended based on activity analysis.',
            action.savingsCalculation || 'Documented formula based on standard factors.',
            action.status || 'planned',
          ],
        );
      }
      const actionResult = await db.query('SELECT * FROM coach_actions WHERE plan_id = $1 ORDER BY day_number ASC', [planRow.id]);
      result.push(serializePlan(planRow, actionResult.rows, freshPlan.recommendations));
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

    const activities = await getActivities(req.user.id);
    const freshPlan = buildCoachPlan({ activities });
    const actions = await db.query('SELECT * FROM coach_actions WHERE plan_id = $1 AND user_id = $2 ORDER BY day_number ASC', [req.params.id, req.user.id]);
    res.json(serializePlan(plan.rows[0], actions.rows, freshPlan.recommendations));
  } catch (error) {
    sendError(res, error, 'Unable to fetch coach plan');
  }
};

const getRecommendations = async (req, res) => {
  try {
    const activities = await getActivities(req.user.id);
    const completedHistory = await getCompletedActions(req.user.id);
    const plan = buildCoachPlan({ activities, completedHistory });

    res.json({
      highestImpactCategories: plan.highestImpactCategories,
      recommendations: plan.recommendations,
      activityCount: plan.activityCount,
      evaluatedAt: new Date().toISOString(),
    });
  } catch (error) {
    sendError(res, error, 'Unable to generate recommendations');
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

const acceptAction = async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE coach_actions
       SET status = 'planned'
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.actionId, req.user.id],
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Coach action not found.' });
    res.json(serializeAction(result.rows[0]));
  } catch (error) {
    sendError(res, error, 'Unable to accept coach action');
  }
};

const dismissAction = async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE coach_actions
       SET status = 'dismissed'
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.actionId, req.user.id],
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Coach action not found.' });
    res.json(serializeAction(result.rows[0]));
  } catch (error) {
    sendError(res, error, 'Unable to dismiss coach action');
  }
};

const getGoals = async (req, res) => {
  try {
    const goalsResult = await db.query(
      `SELECT * FROM coach_goals WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id],
    );

    const activities = await getActivities(req.user.id);
    const completedResult = await db.query(
      `SELECT category, estimated_potential_savings_kg, completed_at FROM coach_actions
       WHERE user_id = $1 AND status = 'completed'`,
      [req.user.id],
    );

    const evaluatedGoals = goalsResult.rows.map((goal) => {
      const completedForGoal = completedResult.rows.filter((act) => {
        if (!goal.started_at) return true;
        return new Date(act.completed_at) >= new Date(goal.started_at);
      });

      return evaluateGoalProgress({
        goal,
        activities,
        completedActions: completedForGoal,
      });
    });

    res.json(evaluatedGoals);
  } catch (error) {
    sendError(res, error, 'Unable to fetch coach goals');
  }
};

const createGoal = async (req, res) => {
  try {
    const input = validateGoal(req.body);
    const activities = await getActivities(req.user.id);
    const plan = buildCoachPlan({ activities });

    // Determine baseline from user's actual history
    let categoryBaseline = 0;
    if (input.category) {
      categoryBaseline = plan.highestImpactCategories.find((item) => item.category === input.category)?.emissionsKg || 0;
    } else {
      categoryBaseline = plan.highestImpactCategories.reduce((total, item) => total + item.emissionsKg, 0);
    }

    const reductionPct = categoryBaseline > 0
      ? Number((Math.max(0, categoryBaseline - input.targetKg) / categoryBaseline * 100).toFixed(1))
      : 0;

    const result = await db.query(
      `INSERT INTO coach_goals (user_id, period, category, target_kg, baseline_kg, target_reduction_pct)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, input.period, input.category, input.targetKg, categoryBaseline, reductionPct],
    );
    const goal = result.rows[0];

    const evaluated = evaluateGoalProgress({
      goal,
      activities,
      completedActions: [],
    });

    res.status(201).json(evaluated);
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

    const activities = await getActivities(req.user.id);
    const completedResult = await db.query(
      `SELECT category, estimated_potential_savings_kg, completed_at FROM coach_actions
       WHERE user_id = $1 AND status = 'completed'`,
      [req.user.id],
    );

    const evaluated = evaluateGoalProgress({
      goal: result.rows[0],
      activities,
      completedActions: completedResult.rows,
    });

    res.json(evaluated);
  } catch (error) {
    sendError(res, error, 'Unable to update coach goal');
  }
};

module.exports = {
  acceptAction,
  createGoal,
  createPlan,
  dismissAction,
  getGoals,
  getPlan,
  getPlans,
  getRecommendations,
  updateAction,
  updateGoal,
};
