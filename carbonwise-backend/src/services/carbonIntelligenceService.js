const EMISSION_FACTORS = {
  transport: { label: 'Transport', unit: 'km', factor: 0.21, reductionRate: 0.2, rationale: 'Combine trips, use public transport, walk, or cycle for short journeys.' },
  electricity: { label: 'Electricity', unit: 'kWh', factor: 0.5, reductionRate: 0.15, rationale: 'Reduce standby power and shift usage to efficient appliances and lighting.' },
  food: { label: 'Food', unit: 'meal', factor: 2.5, reductionRate: 0.25, rationale: 'Replace some high-emission meals with plant-forward alternatives.' },
  flight: { label: 'Flights', unit: 'km', factor: 0.255, reductionRate: 0.1, rationale: 'Prefer rail or virtual meetings where practical and consolidate trips.' },
  shopping: { label: 'Shopping', unit: 'item', factor: 5, reductionRate: 0.15, rationale: 'Buy fewer, longer-lasting items and choose lower-impact alternatives.' },
};

const getEmissionFactor = (category) => {
  const normalizedCategory = typeof category === 'string' ? category.trim().toLowerCase() : '';
  return EMISSION_FACTORS[normalizedCategory] || null;
};

const calculateActivityEmissions = (category, details) => {
  const factor = getEmissionFactor(category);
  const value = Number(typeof details === 'object' ? details?.value : details);
  if (!factor || !Number.isFinite(value) || value < 0) {
    const error = new Error('Activity category and non-negative numeric value are required.');
    error.statusCode = 400;
    throw error;
  }
  return round(value * factor.factor);
};

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const parseActivity = (activity) => {
  let date = '';
  if (typeof activity.date === 'string') {
    date = activity.date.slice(0, 10);
  } else if (activity.date instanceof Date) {
    date = activity.date.toISOString().slice(0, 10);
  }
  const emissions = Number(activity.carbon_emissions);
  const category = typeof activity.activity_type === 'string'
    ? activity.activity_type.trim().toLowerCase()
    : '';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !category || !Number.isFinite(emissions) || emissions < 0) {
    return null;
  }

  return { date, category, emissions };
};

const dateFromIso = (isoDate) => new Date(`${isoDate}T12:00:00Z`);
const isoDate = (date) => date.toISOString().slice(0, 10);
const addDays = (iso, amount) => {
  const date = dateFromIso(iso);
  date.setUTCDate(date.getUTCDate() + amount);
  return isoDate(date);
};

const sum = (activities) => round(activities.reduce((total, activity) => total + activity.emissions, 0));

const dailyTotals = (activities, startDate, endDate) => {
  const totals = {};
  for (let cursor = startDate; cursor <= endDate; cursor = addDays(cursor, 1)) {
    totals[cursor] = 0;
  }
  activities.forEach((activity) => {
    if (activity.date >= startDate && activity.date <= endDate) {
      totals[activity.date] = round((totals[activity.date] || 0) + activity.emissions);
    }
  });
  return totals;
};

const categoryTotals = (activities) => {
  const totals = {};
  activities.forEach((activity) => {
    totals[activity.category] = round((totals[activity.category] || 0) + activity.emissions);
  });
  return totals;
};

const comparePeriods = (current, previous) => {
  const absoluteChange = round(current - previous);
  const percentageChange = previous === 0
    ? (current === 0 ? 0 : null)
    : round((absoluteChange / previous) * 100);

  return {
    current: round(current),
    previous: round(previous),
    absoluteChange,
    percentageChange,
    status: previous === 0 ? (current === 0 ? 'unchanged' : 'new') : absoluteChange > 0 ? 'increase' : absoluteChange < 0 ? 'decrease' : 'unchanged',
  };
};

const standardDeviation = (values, mean) => {
  if (values.length === 0) return 0;
  return Math.sqrt(values.reduce((total, value) => total + ((value - mean) ** 2), 0) / values.length);
};

const detectAnomalies = (currentDaily, previousDaily) => {
  const baselineValues = Object.values(previousDaily);
  const baselineMean = baselineValues.length ? sum(baselineValues) / baselineValues.length : 0;
  const baselineStdDev = standardDeviation(baselineValues, baselineMean);
  const threshold = baselineMean === 0
    ? 5
    : Math.max(baselineMean * 1.5, baselineMean + (2 * baselineStdDev));

  return Object.entries(currentDaily)
    .filter(([, emissions]) => emissions >= threshold && (baselineMean === 0 ? emissions > 0 : emissions > baselineMean))
    .map(([date, emissions]) => ({
      date,
      emissions: round(emissions),
      baselineDailyAverage: round(baselineMean),
      threshold: round(threshold),
      explanation: baselineMean === 0
        ? `This day recorded ${round(emissions)} kg CO₂ after no measurable emissions in the equivalent baseline days.`
        : `This day recorded ${round(emissions)} kg CO₂, above the ${round(threshold)} kg rule threshold (baseline average plus two standard deviations, with a 1.5× minimum).`,
    }));
};

const buildRecommendations = (currentActivities, currentTotal) => {
  const totals = categoryTotals(currentActivities);

  return Object.entries(totals)
    .map(([category, emissions]) => {
      const factor = EMISSION_FACTORS[category];
      const reductionRate = factor?.reductionRate || 0.1;
      const potentialSavingsKg = round(emissions * reductionRate);
      const contributionPercentage = currentTotal === 0 ? 0 : round((emissions / currentTotal) * 100);

      return {
        category,
        label: factor?.label || category.replace(/^\w/, (letter) => letter.toUpperCase()),
        rank: 0,
        currentEmissions: round(emissions),
        contributionPercentage,
        potentialSavingsKg,
        reductionRatePercentage: round(reductionRate * 100),
        reason: factor?.rationale || 'Review this activity category and reduce unnecessary usage where practical.',
      };
    })
    .sort((a, b) => b.potentialSavingsKg - a.potentialSavingsKg || b.currentEmissions - a.currentEmissions)
    .map((recommendation, index) => ({ ...recommendation, rank: index + 1 }));
};

const buildIntelligence = ({ activities, currentStart, currentEnd, previousStart, previousEnd, periodDays }) => {
  const parsedActivities = activities.map(parseActivity);
  const validActivities = parsedActivities.filter(Boolean);
  const invalidActivityCount = parsedActivities.length - validActivities.length;
  const currentActivities = validActivities.filter((activity) => activity.date >= currentStart && activity.date <= currentEnd);
  const previousActivities = validActivities.filter((activity) => activity.date >= previousStart && activity.date <= previousEnd);
  const currentTotal = sum(currentActivities);
  const previousTotal = sum(previousActivities);
  const categories = categoryTotals(currentActivities);
  const daily = dailyTotals(currentActivities, currentStart, currentEnd);
  const previousDaily = dailyTotals(previousActivities, previousStart, previousEnd);
  const categoryBreakdown = Object.entries(categories)
    .map(([category, emissions]) => ({
      category,
      label: EMISSION_FACTORS[category]?.label || category.replace(/^\w/, (letter) => letter.toUpperCase()),
      emissions: round(emissions),
      contributionPercentage: currentTotal === 0 ? 0 : round((emissions / currentTotal) * 100),
    }))
    .sort((a, b) => b.emissions - a.emissions);

  return {
    period: { days: periodDays, currentStart, currentEnd, previousStart, previousEnd },
    totals: {
      daily: round(currentTotal / periodDays),
      weekly: round(currentTotal / periodDays * 7),
      monthly: round(currentTotal / periodDays * 30),
      currentPeriod: currentTotal,
      previousPeriod: previousTotal,
    },
    comparison: comparePeriods(currentTotal, previousTotal),
    categoryBreakdown,
    largestSources: categoryBreakdown.slice(0, 3),
    trends: Object.entries(daily).map(([date, emissions]) => ({ date, emissions: round(emissions) })),
    anomalies: detectAnomalies(daily, previousDaily),
    recommendations: buildRecommendations(currentActivities, currentTotal),
    activityCount: currentActivities.length,
    invalidActivityCount,
  };
};

const getPeriodBounds = (periodDays, today = isoDate(new Date())) => {
  const currentStart = addDays(today, -(periodDays - 1));
  const previousEnd = addDays(currentStart, -1);
  const previousStart = addDays(previousEnd, -(periodDays - 1));
  return { currentStart, currentEnd: today, previousStart, previousEnd };
};

module.exports = {
  EMISSION_FACTORS,
  addDays,
  buildIntelligence,
  calculateActivityEmissions,
  comparePeriods,
  detectAnomalies,
  getEmissionFactor,
  getPeriodBounds,
  parseActivity,
};
