const { addDays, EMISSION_FACTORS, parseActivity } = require('./carbonIntelligenceService');

const PERIODS = new Set([30, 90, 365]);
const HORIZONS = new Set([7, 30]);
const MINIMUM_OBSERVED_DAYS = 3;
const MINIMUM_MONTHLY_DAYS = 14;

const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const standardDeviation = (values, mean) => values.length
  ? Math.sqrt(values.reduce((total, value) => total + ((value - mean) ** 2), 0) / values.length)
  : 0;

const dailyTotals = (activities, startDate, endDate) => {
  const totals = {};
  for (let cursor = startDate; cursor <= endDate; cursor = addDays(cursor, 1)) totals[cursor] = 0;
  activities.forEach((activity) => {
    if (activity.date >= startDate && activity.date <= endDate) totals[activity.date] = round(totals[activity.date] + activity.emissions);
  });
  return totals;
};

const categoryLabel = (category) => EMISSION_FACTORS[category]?.label
  || category.replace(/^\w/, (letter) => letter.toUpperCase());

const parseForecastActivity = (activity) => {
  const parsed = parseActivity(activity);
  if (!parsed) return null;
  return { ...parsed, id: activity.id == null ? null : Number(activity.id) };
};

const getForecastConfig = ({ periodDays = 30, horizonDays = 7 }) => {
  const period = Number(periodDays);
  const horizon = Number(horizonDays);
  return {
    periodDays: PERIODS.has(period) ? period : 30,
    horizonDays: HORIZONS.has(horizon) ? horizon : 7,
  };
};

const buildForecast = ({ activities, startDate, endDate, periodDays = 30, horizonDays = 7 }) => {
  const config = getForecastConfig({ periodDays, horizonDays });
  const parsed = activities.map(parseForecastActivity);
  const valid = parsed.filter(Boolean);
  const invalidActivityCount = parsed.length - valid.length;
  const daily = dailyTotals(valid, startDate, endDate);
  const actualValues = Object.values(daily);
  const observedDays = Object.values(daily).filter((value) => value > 0).length;
  const lastSeven = actualValues.slice(-7);
  const baselineDailyAverage = lastSeven.length
    ? round(lastSeven.reduce((total, value) => total + value, 0) / lastSeven.length)
    : 0;
  const sufficientForWeekly = observedDays >= MINIMUM_OBSERVED_DAYS;
  const sufficientForMonthly = observedDays >= MINIMUM_MONTHLY_DAYS;
  const isSufficient = config.horizonDays === 30 ? sufficientForMonthly : sufficientForWeekly;
  const forecastStart = addDays(endDate, 1);
  const actual = Object.entries(daily).map(([date, emissions]) => ({ date, emissions: round(emissions), kind: 'actual' }));
  const forecast = isSufficient
    ? Array.from({ length: config.horizonDays }, (_, index) => ({
      date: addDays(forecastStart, index),
      emissions: baselineDailyAverage,
      kind: 'forecast',
    }))
    : [];

  const anomalyValues = actualValues;
  const anomalyMean = anomalyValues.length ? anomalyValues.reduce((total, value) => total + value, 0) / anomalyValues.length : 0;
  const anomalyStdDev = standardDeviation(anomalyValues, anomalyMean);
  const threshold = anomalyMean === 0 ? 5 : Math.max(anomalyMean * 1.5, anomalyMean + (2 * anomalyStdDev));
  const anomalies = actual
    .filter((point) => point.emissions >= threshold && point.emissions > anomalyMean)
    .map((point) => {
      const records = valid.filter((activity) => activity.date === point.date);
      const categoryTotals = records.reduce((totals, activity) => {
        totals[activity.category] = round((totals[activity.category] || 0) + activity.emissions);
        return totals;
      }, {});
      const category = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
      return {
        date: point.date,
        emissions: point.emissions,
        category: category?.[0] || null,
        categoryLabel: category ? categoryLabel(category[0]) : 'All categories',
        categoryEmissions: category?.[1] || point.emissions,
        baselineDailyAverage: round(anomalyMean),
        standardDeviation: round(anomalyStdDev),
        threshold: round(threshold),
        explanation: `This day recorded ${point.emissions} kg CO₂, above the ${round(threshold)} kg rule threshold based on the historical average and standard deviation.`,
        activityRecords: records.map((activity) => ({
          id: activity.id,
          date: activity.date,
          category: activity.category,
          categoryLabel: categoryLabel(activity.category),
          emissions: activity.emissions,
        })),
      };
    });

  return {
    period: { startDate, endDate, days: config.periodDays },
    forecast: {
      method: 'Trailing 7-day moving average',
      horizonDays: config.horizonDays,
      baselineDailyAverage,
      actual,
      projected: forecast,
      sufficientData: isSufficient,
      limitation: isSufficient
        ? 'Projection assumes the recent daily pattern continues; it does not account for seasonality, planned changes, or future behavior.'
        : `At least ${config.horizonDays === 30 ? MINIMUM_MONTHLY_DAYS : MINIMUM_OBSERVED_DAYS} days with recorded emissions are needed for this horizon.`,
    },
    anomalies,
    dataQuality: {
      activityCount: valid.length,
      invalidActivityCount,
      observedDays,
    },
  };
};

module.exports = {
  HORIZONS,
  MINIMUM_MONTHLY_DAYS,
  MINIMUM_OBSERVED_DAYS,
  PERIODS,
  buildForecast,
  getForecastConfig,
};
