const { buildIntelligence, getPeriodBounds, parseActivity, EMISSION_FACTORS } = require('./carbonIntelligenceService');

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const PERIODS = new Set([7, 30, 90, 365]);

const normalizePeriod = (value, fallback = 30) => {
  const period = Number(value);
  return PERIODS.has(period) ? period : fallback;
};

const sum = (activities) => round(activities.reduce((total, activity) => total + activity.emissions, 0));

const categoryTotals = (activities) => activities.reduce((totals, activity) => {
  totals[activity.category] = round((totals[activity.category] || 0) + activity.emissions);
  return totals;
}, {});

const buildImpactReport = ({ activities, currentPeriod = 30, baseline }) => {
  const periodDays = normalizePeriod(currentPeriod);
  const bounds = getPeriodBounds(periodDays);
  const parsed = activities.map(parseActivity);
  const valid = parsed.filter(Boolean);
  const current = valid.filter((activity) => activity.date >= bounds.currentStart && activity.date <= bounds.currentEnd);
  const baselineStart = baseline?.startDate || bounds.previousStart;
  const baselineEnd = baseline?.endDate || bounds.previousEnd;
  const baselineActivities = valid.filter((activity) => activity.date >= baselineStart && activity.date <= baselineEnd);
  const currentTotal = sum(current);
  const baselineTotal = sum(baselineActivities);
  const categories = categoryTotals(current);
  const categoryBreakdown = Object.entries(categories)
    .map(([category, emissions]) => ({
      category,
      label: EMISSION_FACTORS[category]?.label || category,
      emissions,
      contributionPercentage: currentTotal ? round(emissions / currentTotal * 100) : 0,
      potentialSavingsKg: round(emissions * (EMISSION_FACTORS[category]?.reductionRate || 0.1)),
    }))
    .sort((a, b) => b.emissions - a.emissions);
  const absoluteChange = round(currentTotal - baselineTotal);
  const percentageChange = baselineTotal === 0 ? null : round(absoluteChange / baselineTotal * 100);
  const status = baselineTotal === 0 ? (currentTotal === 0 ? 'unchanged' : 'new') : absoluteChange < 0 ? 'decrease' : absoluteChange > 0 ? 'increase' : 'unchanged';
  const intelligence = buildIntelligence({ activities, periodDays, ...bounds });

  return {
    period: { days: periodDays, currentStart: bounds.currentStart, currentEnd: bounds.currentEnd, baselineStart, baselineEnd },
    totals: { current: currentTotal, baseline: baselineTotal, absoluteChange, percentageChange, status },
    categoryBreakdown,
    trends: intelligence.trends,
    goals: [],
    actionHistory: [],
    potentialSavingsKg: round(categoryBreakdown.reduce((total, item) => total + item.potentialSavingsKg, 0)),
    limitations: 'Observed changes describe recorded emissions only. Goal completion and modeled potential savings do not prove that an action caused a reduction.',
    activityCount: current.length,
    invalidActivityCount: parsed.length - valid.length,
  };
};

const validateBaseline = ({ periodDays, startDate, endDate }) => {
  const days = normalizePeriod(periodDays);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) {
    throw new Error('Baseline dates must be valid ISO dates with startDate before endDate.');
  }
  return { periodDays: days, startDate, endDate };
};

module.exports = { buildImpactReport, categoryTotals, normalizePeriod, validateBaseline };
