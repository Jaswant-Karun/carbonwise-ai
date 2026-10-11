const { EMISSION_FACTORS, getEmissionFactor, parseActivity } = require('./carbonIntelligenceService');

const TRANSPORT_MODE_FACTORS = {
  car: { label: 'Car', factor: 0.21, unit: 'km' },
  public_transport: { label: 'Public transport', factor: 0.08, unit: 'km' },
  cycling: { label: 'Cycling', factor: 0, unit: 'km' },
  walking: { label: 'Walking', factor: 0, unit: 'km' },
};

const VALID_ACTIONS = new Set(['reduce', 'switch_transport']);
const MAX_PERIOD_DAYS = 365;
const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const validationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const asFiniteNumber = (value, field) => {
  const number = Number(value);
  if (!Number.isFinite(number)) throw validationError(`${field} must be a finite number.`);
  return number;
};

const validatePeriodDays = (value) => {
  const periodDays = asFiniteNumber(value ?? 30, 'periodDays');
  if (!Number.isInteger(periodDays) || periodDays < 1 || periodDays > MAX_PERIOD_DAYS) {
    throw validationError(`periodDays must be an integer between 1 and ${MAX_PERIOD_DAYS}.`);
  }
  return periodDays;
};

const normalizeChanges = (changes) => {
  if (!Array.isArray(changes) || changes.length === 0 || changes.length > 10) {
    throw validationError('changes must contain between 1 and 10 scenario changes.');
  }

  const seenCategories = new Set();
  return changes.map((change, index) => {
    if (!change || typeof change !== 'object') {
      throw validationError(`Change ${index + 1} must be an object.`);
    }

    const action = typeof change.action === 'string' ? change.action.trim().toLowerCase() : '';
    const category = typeof change.category === 'string' ? change.category.trim().toLowerCase() : '';
    if (!VALID_ACTIONS.has(action)) throw validationError(`Change ${index + 1} has an unsupported action.`);
    if (!getEmissionFactor(category)) throw validationError(`Change ${index + 1} has an unsupported category.`);
    if (seenCategories.has(category)) throw validationError(`Only one change per category is supported; combine changes for ${category}.`);
    seenCategories.add(category);

    if (action === 'reduce') {
      const percentage = asFiniteNumber(change.percentage, `Change ${index + 1} percentage`);
      if (percentage < 0 || percentage > 100) throw validationError(`Change ${index + 1} percentage must be between 0 and 100.`);
      return { action, category, percentage: round(percentage) };
    }

    if (category !== 'transport') throw validationError('Only transport activities can switch mode.');
    const targetMode = typeof change.targetMode === 'string' ? change.targetMode.trim().toLowerCase() : '';
    if (!TRANSPORT_MODE_FACTORS[targetMode]) throw validationError(`Change ${index + 1} has an unsupported transport mode.`);
    const percentage = asFiniteNumber(change.percentage ?? 100, `Change ${index + 1} percentage`);
    if (percentage < 0 || percentage > 100) throw validationError(`Change ${index + 1} percentage must be between 0 and 100.`);
    return { action, category, targetMode, percentage: round(percentage) };
  });
};

const calculateScenario = ({ activities, periodDays = 30, changes }) => {
  const parsedActivities = activities.map(parseActivity);
  const validActivities = parsedActivities.filter(Boolean);
  const invalidActivityCount = parsedActivities.length - validActivities.length;
  const normalizedChanges = normalizeChanges(changes);
  const categoryTotals = validActivities.reduce((totals, activity) => {
    totals[activity.category] = (totals[activity.category] || 0) + activity.emissions;
    return totals;
  }, {});
  const baseline = round(validActivities.reduce((total, activity) => total + activity.emissions, 0));
  let scenario = baseline;
  const assumptions = [];

  normalizedChanges.forEach((change) => {
    const categoryBaseline = categoryTotals[change.category] || 0;
    let savings = 0;

    if (change.action === 'reduce') {
      savings = categoryBaseline * (change.percentage / 100);
      assumptions.push(`${change.percentage}% reduction in ${EMISSION_FACTORS[change.category].label.toLowerCase()} emissions.`);
    } else {
      const sourceFactor = EMISSION_FACTORS.transport;
      const targetFactor = TRANSPORT_MODE_FACTORS[change.targetMode];
      const switchedEmissions = categoryBaseline * (targetFactor.factor / sourceFactor.factor) * (change.percentage / 100);
      const unchangedEmissions = categoryBaseline * (1 - (change.percentage / 100));
      savings = categoryBaseline - (switchedEmissions + unchangedEmissions);
      assumptions.push(`${change.percentage}% of transport is switched to ${targetFactor.label.toLowerCase()} at ${targetFactor.factor} kg CO₂/km.`);
    }

    scenario -= savings;
  });

  const savingsKg = round(Math.max(0, baseline - scenario));
  return {
    periodDays,
    baselineEmissionsKg: baseline,
    scenarioEmissionsKg: round(Math.max(0, scenario)),
    potentialSavingsKg: savingsKg,
    potentialSavingsPercentage: baseline === 0 ? 0 : round((savingsKg / baseline) * 100),
    assumptions,
    changes: normalizedChanges,
    invalidActivityCount,
    activityCount: validActivities.length,
    isEstimate: true,
  };
};

module.exports = {
  MAX_PERIOD_DAYS,
  TRANSPORT_MODE_FACTORS,
  calculateScenario,
  normalizeChanges,
  validatePeriodDays,
};
