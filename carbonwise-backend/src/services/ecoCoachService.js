const { EMISSION_FACTORS, buildIntelligence, getPeriodBounds, parseActivity } = require('./carbonIntelligenceService');

const ACTION_STATUSES = new Set(['planned', 'in_progress', 'completed', 'skipped']);
const GOAL_PERIODS = new Set(['weekly', 'monthly']);
const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const fallbackTemplates = {
  transport: {
    title: 'Reduce one car journey',
    explanation: 'Replace one practical car journey with walking, cycling, public transport, or trip consolidation.',
    target: 'Replace or combine 1 journey this week.',
  },
  electricity: {
    title: 'Cut avoidable electricity use',
    explanation: 'Switch off standby devices and unused lights, and use efficient settings where practical.',
    target: 'Reduce electricity-related activity by 15% this week.',
  },
  food: {
    title: 'Choose a lower-impact meal',
    explanation: 'Swap one higher-emission meal for a plant-forward or lower-impact alternative.',
    target: 'Choose 2 lower-impact meals this week.',
  },
  flight: {
    title: 'Avoid or consolidate one flight journey',
    explanation: 'Consider rail, remote attendance, or combining trips when the choice is practical.',
    target: 'Review 1 upcoming flight decision this week.',
  },
  shopping: {
    title: 'Pause one non-essential purchase',
    explanation: 'Delay or avoid one non-essential purchase and choose a durable option when buying is needed.',
    target: 'Avoid 1 non-essential item this week.',
  },
};

const validateStatus = (status) => {
  const normalized = typeof status === 'string' ? status.trim().toLowerCase() : '';
  if (!ACTION_STATUSES.has(normalized)) throw new Error('Invalid action status.');
  return normalized;
};

const validateGoal = ({ period, targetKg, category }) => {
  if (!GOAL_PERIODS.has(period)) throw new Error('Goal period must be weekly or monthly.');
  const target = Number(targetKg);
  if (!Number.isFinite(target) || target <= 0 || target > 100000) throw new Error('Goal target must be between 0 and 100000 kg CO₂.');
  if (category && !EMISSION_FACTORS[category]) throw new Error('Goal category has no supported emission factor.');
  return { period, targetKg: round(target), category: category || null };
};

const buildFallbackActions = ({ intelligence, completedHistory = [] }) => {
  const completionByCategory = completedHistory.reduce((counts, action) => {
    counts[action.category] = (counts[action.category] || 0) + 1;
    return counts;
  }, {});

  return intelligence.largestSources.slice(0, 3).map((source, index) => {
    const template = fallbackTemplates[source.category] || {
      title: `Review ${source.label.toLowerCase()} emissions`,
      explanation: `Review your ${source.label.toLowerCase()} activity and identify one practical reduction.`,
      target: `Review 1 ${source.label.toLowerCase()} choice this week.`,
    };
    const factor = EMISSION_FACTORS[source.category];
    const potentialSavingsKg = round(source.emissions * (factor?.reductionRate || 0.1));
    const completedBefore = completionByCategory[source.category] || 0;
    return {
      dayNumber: index + 1,
      category: source.category,
      title: completedBefore
        ? `${template.title} again`
        : template.title,
      explanation: completedBefore
        ? `${template.explanation} You have completed ${completedBefore} related action${completedBefore === 1 ? '' : 's'} before; try a slightly more consistent version.`
        : template.explanation,
      suggestedTarget: template.target,
      estimatedPotentialSavingsKg: potentialSavingsKg,
      sourceEmissionsKg: source.emissions,
      isEstimate: true,
    };
  });
};

const validateActions = (actions) => {
  if (!Array.isArray(actions) || actions.length < 1 || actions.length > 7) {
    throw new Error('A coach plan must contain between 1 and 7 actions.');
  }
  return actions.map((action, index) => {
    if (!action || typeof action !== 'object' || typeof action.title !== 'string' || !action.title.trim()) {
      throw new Error(`Action ${index + 1} has an invalid title.`);
    }
    if (!action.category || !EMISSION_FACTORS[action.category]) {
      throw new Error(`Action ${index + 1} has an unsupported category.`);
    }
    if (typeof action.explanation !== 'string' || !action.explanation.trim()
      || typeof action.suggestedTarget !== 'string' || !action.suggestedTarget.trim()) {
      throw new Error(`Action ${index + 1} must include an explanation and suggested target.`);
    }
    const savings = action.estimatedPotentialSavingsKg == null ? null : Number(action.estimatedPotentialSavingsKg);
    if (savings !== null && (!Number.isFinite(savings) || savings < 0)) {
      throw new Error(`Action ${index + 1} has an invalid estimated saving.`);
    }
    return {
      dayNumber: Number.isInteger(action.dayNumber) ? action.dayNumber : index + 1,
      category: action.category,
      title: action.title.trim().slice(0, 160),
      explanation: action.explanation.trim().slice(0, 500),
      suggestedTarget: action.suggestedTarget.trim().slice(0, 240),
      estimatedPotentialSavingsKg: savings === null ? null : round(savings),
      sourceEmissionsKg: Number.isFinite(Number(action.sourceEmissionsKg)) ? round(Number(action.sourceEmissionsKg)) : null,
    };
  });
};

const buildCoachPlan = ({ activities, completedHistory = [], previousActions = [] }) => {
  const parsedActivities = activities.map(parseActivity);
  const bounds = getPeriodBounds(30);
  const intelligence = buildIntelligence({
    activities: parsedActivities.filter(Boolean),
    periodDays: 30,
    ...bounds,
  });
  const actions = validateActions(buildFallbackActions({ intelligence, completedHistory, previousActions }));
  return {
    highestImpactCategories: intelligence.largestSources.map((source) => ({
      category: source.category,
      label: source.label,
      emissionsKg: source.emissions,
      contributionPercentage: source.contributionPercentage,
    })),
    actions,
    activityCount: intelligence.activityCount,
    invalidActivityCount: parsedActivities.length - parsedActivities.filter(Boolean).length,
    isEstimate: true,
    narrativeSource: 'deterministic',
  };
};

module.exports = {
  ACTION_STATUSES,
  GOAL_PERIODS,
  buildCoachPlan,
  buildFallbackActions,
  validateActions,
  validateGoal,
  validateStatus,
};
