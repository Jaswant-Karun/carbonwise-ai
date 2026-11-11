const { addDays, EMISSION_FACTORS, parseActivity } = require('./carbonIntelligenceService');

const PERIODS = new Set([30, 90, 365]);
const HORIZONS = new Set([7, 30, 90]);
const MINIMUM_OBSERVED_DAYS = 3;
const MINIMUM_MONTHLY_DAYS = 14;

const CATEGORY_META = {
  food: { key: 'food', label: 'Food & Diet', color: '#F59E0B' },
  electricity: { key: 'electricity', label: 'Electricity & Energy', color: '#38BDF8' },
  transport: { key: 'transport', label: 'Transportation', color: '#10B981' },
  water: { key: 'water', label: 'Water Usage', color: '#06B6D4' },
  waste: { key: 'waste', label: 'Waste Management', color: '#84CC16' },
  facilities: { key: 'facilities', label: 'Facilities & Buildings', color: '#8B5CF6' },
  other: { key: 'other', label: 'Other Sources', color: '#EC4899' },
};

const round = (value, d = 2) => {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(d)) : 0;
};

const standardDeviation = (values, mean) => {
  if (!values.length) return 0;
  const variance = values.reduce((total, val) => total + ((val - mean) ** 2), 0) / values.length;
  return Math.sqrt(variance);
};

/**
 * Calculates linear regression slope and intercept
 * y = slope * x + intercept
 */
const calculateLinearTrend = (values) => {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] || 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return { slope: 0, intercept: sumY / n };

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return { slope: round(slope, 4), intercept: round(intercept, 4) };
};

const dailyTotals = (activities, startDate, endDate) => {
  const totals = {};
  for (let cursor = startDate; cursor <= endDate; cursor = addDays(cursor, 1)) {
    totals[cursor] = 0;
  }
  activities.forEach((activity) => {
    const actDate = typeof activity.date === 'string' ? activity.date.slice(0, 10) : activity.date;
    if (actDate >= startDate && actDate <= endDate) {
      totals[actDate] = round(totals[actDate] + (parseFloat(activity.emissions || activity.carbon_emissions) || 0));
    }
  });
  return totals;
};

const categoryDailyTotals = (activities, startDate, endDate) => {
  const totals = {};
  Object.keys(CATEGORY_META).forEach((cat) => {
    totals[cat] = {};
    for (let cursor = startDate; cursor <= endDate; cursor = addDays(cursor, 1)) {
      totals[cat][cursor] = 0;
    }
  });

  activities.forEach((activity) => {
    const cat = (activity.category || activity.activity_type || 'other').toLowerCase();
    const actDate = typeof activity.date === 'string' ? activity.date.slice(0, 10) : activity.date;
    if (totals[cat] && actDate >= startDate && actDate <= endDate) {
      totals[cat][actDate] = round(totals[cat][actDate] + (parseFloat(activity.emissions || activity.carbon_emissions) || 0));
    }
  });

  return totals;
};

const categoryLabel = (category) =>
  CATEGORY_META[category]?.label ||
  EMISSION_FACTORS[category]?.label ||
  category.replace(/^\w/, (letter) => letter.toUpperCase());

const parseForecastActivity = (activity) => {
  const parsed = parseActivity(activity);
  if (!parsed) return null;
  return {
    ...parsed,
    id: activity.id == null ? null : Number(activity.id),
    details: activity.details || {},
  };
};

const getForecastConfig = ({ periodDays = 30, horizonDays = 7 }) => {
  const period = Number(periodDays);
  const horizon = Number(horizonDays);
  return {
    periodDays: PERIODS.has(period) ? period : 30,
    horizonDays: HORIZONS.has(horizon) ? horizon : 7,
  };
};

/**
 * Core Time-Series Statistical Forecasting and Anomaly Detection Engine
 */
const buildForecast = ({
  activities = [],
  startDate,
  endDate,
  periodDays = 30,
  horizonDays = 7,
  whatIfReductions = null,
}) => {
  const config = getForecastConfig({ periodDays, horizonDays });
  const parsed = activities.map(parseForecastActivity);
  const valid = parsed.filter(Boolean);
  const invalidActivityCount = parsed.length - valid.length;

  const daily = dailyTotals(valid, startDate, endDate);
  const actualValues = Object.values(daily);
  const observedDays = actualValues.filter((value) => value > 0).length;

  // Baseline moving averages
  const lastSeven = actualValues.slice(-7);
  const baselineDailyAverage = lastSeven.length
    ? round(lastSeven.reduce((total, value) => total + value, 0) / lastSeven.length)
    : 0;

  const sufficientForWeekly = observedDays >= MINIMUM_OBSERVED_DAYS;
  const sufficientForMonthly = observedDays >= MINIMUM_MONTHLY_DAYS;
  const isSufficient = config.horizonDays >= 30 ? sufficientForMonthly : sufficientForWeekly;

  // Linear trend across the observation window
  const activeSeries = actualValues.filter((v) => v > 0);
  const linearTrend = calculateLinearTrend(actualValues);
  const overallMean = actualValues.length ? actualValues.reduce((a, b) => a + b, 0) / actualValues.length : 0;
  const overallStdDev = standardDeviation(actualValues, overallMean);

  // Standard Error of Estimate for Uncertainty Bands
  const standardError = round(
    activeSeries.length > 2
      ? standardDeviation(activeSeries, baselineDailyAverage) / Math.sqrt(Math.min(activeSeries.length, 7))
      : Math.max(0.5, baselineDailyAverage * 0.15)
  );
  const zScore = 1.96; // 95% Confidence Interval

  const forecastStart = addDays(endDate, 1);
  const actual = Object.entries(daily).map(([date, emissions]) => ({
    date,
    emissions: round(emissions),
    kind: 'actual',
  }));

  // Generate Projected Sequence with Uncertainty Bands
  let forecast = [];
  if (isSufficient) {
    forecast = Array.from({ length: config.horizonDays }, (_, index) => {
      const dayDate = addDays(forecastStart, index);
      // Trend-adjusted projection with baseline smoothing
      const trendAdjustment = linearTrend.slope * (index + 1);
      const projectedVal = Math.max(0, round(baselineDailyAverage + Math.min(Math.max(trendAdjustment, -baselineDailyAverage * 0.4), baselineDailyAverage * 0.4)));
      const margin = round(zScore * (standardError * (1 + (index / config.horizonDays) * 0.3)));
      const lower = Math.max(0, round(projectedVal - margin));
      const upper = round(projectedVal + margin);

      return {
        date: dayDate,
        emissions: baselineDailyAverage, // Exact backward-compatible field
        projectedEmissions: projectedVal,
        lowerBound: lower,
        upperBound: upper,
        margin,
        kind: 'forecast',
      };
    });
  }

  // Horizon-Specific Totals
  const totalProjectedKg = isSufficient ? round(baselineDailyAverage * config.horizonDays) : 0;
  const totalProjectedTonnes = round(totalProjectedKg / 1000.0, 4);

  // Next Month (30d) and Next Three Months (90d) Estimates
  const nextMonthKg = isSufficient ? round(baselineDailyAverage * 30) : 0;
  const nextMonthTonnes = round(nextMonthKg / 1000.0, 4);
  const nextThreeMonthsKg = isSufficient ? round(baselineDailyAverage * 90) : 0;
  const nextThreeMonthsTonnes = round(nextThreeMonthsKg / 1000.0, 4);

  // Category-Based Projections & Pattern Analysis
  const catDaily = categoryDailyTotals(valid, startDate, endDate);
  const categoryPredictions = Object.keys(CATEGORY_META).map((catKey) => {
    const meta = CATEGORY_META[catKey];
    const series = Object.values(catDaily[catKey] || {});
    const catTotal = series.reduce((a, b) => a + b, 0);
    const catLastSeven = series.slice(-7);
    const catDailyAvg = catLastSeven.length ? round(catLastSeven.reduce((a, b) => a + b, 0) / catLastSeven.length) : 0;
    const catTrend = calculateLinearTrend(series);

    let trendDirection = 'stable';
    if (catTrend.slope > 0.05) trendDirection = 'increasing';
    else if (catTrend.slope < -0.05) trendDirection = 'decreasing';

    const projectedHorizonKg = round(catDailyAvg * config.horizonDays);
    const projectedHorizonTonnes = round(projectedHorizonKg / 1000.0, 4);
    const shareOfFuture = totalProjectedKg > 0 ? round((projectedHorizonKg / totalProjectedKg) * 100, 1) : 0;

    let insight = `Projected daily baseline of ${catDailyAvg} kg CO₂e.`;
    if (catKey === 'electricity') {
      insight = trendDirection === 'increasing'
        ? 'Electricity consumption indicates an upward pattern; off-peak shifting recommended.'
        : 'Electricity emissions remain consistent with recent meter readings.';
    } else if (catKey === 'transport') {
      insight = `Estimated travel emissions totaling ${projectedHorizonKg} kg over the next ${config.horizonDays} days.`;
    } else if (catKey === 'food') {
      insight = 'Dietary footprint pattern based on recent meal consumption and food waste trends.';
    }

    return {
      category: catKey,
      label: meta.label,
      color: meta.color,
      historicalTotalKg: round(catTotal),
      historicalDailyAvg: catDailyAvg,
      projectedKg: projectedHorizonKg,
      projectedTonnes: projectedHorizonTonnes,
      shareOfFuture,
      trendDirection,
      trendSlope: catTrend.slope,
      insight,
    };
  });

  // Sort categories by future footprint
  categoryPredictions.sort((a, b) => b.projectedKg - a.projectedKg);
  const topFutureContributor = categoryPredictions[0]?.projectedKg > 0 ? categoryPredictions[0] : null;

  // Specific Sector Outlooks
  const electricityOutlook = categoryPredictions.find((c) => c.category === 'electricity') || { trendDirection: 'stable', projectedKg: 0 };
  const transportOutlook = categoryPredictions.find((c) => c.category === 'transport') || { trendDirection: 'stable', projectedKg: 0 };
  const foodOutlook = categoryPredictions.find((c) => c.category === 'food') || { trendDirection: 'stable', projectedKg: 0 };

  // Anomaly Detection Engine (with detailed activity root-cause attribution)
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

      const sortedCats = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
      const topCat = sortedCats[0];
      const topCatName = topCat ? topCat[0] : 'other';
      const topCatVal = topCat ? topCat[1] : point.emissions;
      const shareOfAnomaly = point.emissions > 0 ? round((topCatVal / point.emissions) * 100, 1) : 100;

      // Extract specific large activity that drove the spike
      const topRecord = [...records].sort((a, b) => b.emissions - a.emissions)[0];
      const recordSummary = topRecord
        ? `Primary driver was record #${topRecord.id} (${topRecord.category} emitting ${topRecord.emissions} kg).`
        : '';

      return {
        date: point.date,
        emissions: point.emissions,
        category: topCat?.[0] || null,
        categoryLabel: topCat ? categoryLabel(topCat[0]) : 'All categories',
        categoryEmissions: topCatVal,
        shareOfAnomaly,
        baselineDailyAverage: round(anomalyMean),
        standardDeviation: round(anomalyStdDev),
        threshold: round(threshold),
        deviationFactor: round(point.emissions / Math.max(1, anomalyMean), 1),
        explanation: `This day recorded ${point.emissions} kg CO₂, above the ${round(threshold)} kg rule threshold based on the historical average and standard deviation. ${recordSummary}`,
        activityRecords: records.map((activity) => ({
          id: activity.id,
          date: activity.date,
          category: activity.category,
          categoryLabel: categoryLabel(activity.category),
          emissions: activity.emissions,
          details: activity.details,
        })),
      };
    });

  // What-If Reduction Scenario Simulation
  let scenarioSimulation = null;
  if (whatIfReductions && typeof whatIfReductions === 'object') {
    const {
      electricityPct = 0,
      transportPct = 0,
      foodPct = 0,
      wastePct = 0,
      otherPct = 0,
    } = whatIfReductions;

    let simulatedDailyTotal = 0;
    categoryPredictions.forEach((cat) => {
      let reductionRate = 0;
      if (cat.category === 'electricity') reductionRate = Math.min(100, Math.max(0, Number(electricityPct))) / 100;
      else if (cat.category === 'transport') reductionRate = Math.min(100, Math.max(0, Number(transportPct))) / 100;
      else if (cat.category === 'food') reductionRate = Math.min(100, Math.max(0, Number(foodPct))) / 100;
      else if (cat.category === 'waste') reductionRate = Math.min(100, Math.max(0, Number(wastePct))) / 100;
      else reductionRate = Math.min(100, Math.max(0, Number(otherPct))) / 100;

      const reducedDaily = cat.historicalDailyAvg * (1 - reductionRate);
      simulatedDailyTotal += reducedDaily;
    });

    const simulatedTotalKg = round(simulatedDailyTotal * config.horizonDays);
    const savingsKg = round(Math.max(0, totalProjectedKg - simulatedTotalKg));
    const savingsTonnes = round(savingsKg / 1000.0, 4);
    const pctReduction = totalProjectedKg > 0 ? round((savingsKg / totalProjectedKg) * 100, 1) : 0;

    scenarioSimulation = {
      isHypothetical: true,
      horizonDays: config.horizonDays,
      baselineFutureKg: totalProjectedKg,
      simulatedFutureKg: simulatedTotalKg,
      simulatedFutureTonnes: round(simulatedTotalKg / 1000.0, 4),
      potentialSavingsKg: savingsKg,
      potentialSavingsTonnes: savingsTonnes,
      percentageReduction: pctReduction,
      disclaimer: 'Hypothetical simulation based on statistical projection. Does not reflect verified historical reductions.',
    };
  }

  // Structured Explanation & Metadata
  const explanation = {
    predictedValue: `${totalProjectedKg} kg CO₂e (${totalProjectedTonnes} tonnes)`,
    historicalReference: `Trailing 7-day average of ${baselineDailyAverage} kg CO₂e/day across ${valid.length} recorded entries`,
    forecastPeriod: `${config.horizonDays} Days (Starting ${forecastStart})`,
    importantContributingCategories: categoryPredictions.slice(0, 3).map((c) => `${c.label} (${c.shareOfFuture}%)`),
    methodUsed: 'Trailing 7-day moving average with linear trend correction & 95% confidence intervals',
    dataSufficiency: isSufficient
      ? `Sufficient (${observedDays} days with recorded emissions in a ${config.periodDays}-day window)`
      : `Insufficient (${observedDays} observed days; at least ${config.horizonDays === 30 ? MINIMUM_MONTHLY_DAYS : MINIMUM_OBSERVED_DAYS} required)`,
    uncertaintyAndLimitations: isSufficient
      ? `Standard error ±${standardError} kg/day with 95% confidence bands. Assumes current behavioral patterns continue without unrecorded external travel.`
      : `At least ${config.horizonDays === 30 ? MINIMUM_MONTHLY_DAYS : MINIMUM_OBSERVED_DAYS} days with recorded emissions are needed for this horizon.`,
  };

  return {
    period: { startDate, endDate, days: config.periodDays },
    forecast: {
      method: 'Trailing 7-day moving average', // Preserved exact string for backward compatibility
      horizonDays: config.horizonDays,
      baselineDailyAverage,
      totalProjectedKg,
      totalProjectedTonnes,
      nextMonthKg,
      nextMonthTonnes,
      nextThreeMonthsKg,
      nextThreeMonthsTonnes,
      uncertainty: {
        confidenceLevel: '95%',
        standardError,
        marginOfError: round(zScore * standardError),
      },
      actual,
      projected: forecast,
      sufficientData: isSufficient,
      limitation: isSufficient
        ? 'Projection assumes the recent daily pattern continues; it does not account for seasonality, planned changes, or future behavior.'
        : `At least ${config.horizonDays === 30 ? MINIMUM_MONTHLY_DAYS : MINIMUM_OBSERVED_DAYS} days with recorded emissions are needed for this horizon.`,
    },
    categoryPredictions,
    outlooks: {
      electricity: electricityOutlook,
      transport: transportOutlook,
      food: foodOutlook,
      topFutureContributor,
    },
    anomalies,
    scenarioSimulation,
    explanation,
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
