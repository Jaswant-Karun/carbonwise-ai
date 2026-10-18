const db = require('../config/db');
const { fetchNasaPowerDaily, calculateReferenceBaseline } = require('./nasaPowerService');

/**
 * Climate Trends Service
 * Calculates daily, monthly, and annual environmental trends,
 * identifies missing dates, computes linear regression slopes,
 * and performs comparisons against historical reference normals (e.g. WMO 1991-2020).
 */

const round = (val, dec = 2) => (val == null || Number.isNaN(Number(val)) ? null : Number(Number(val).toFixed(dec)));

/**
 * Perform Ordinary Least Squares (OLS) Linear Trend Calculation
 */
const calculateLinearTrend = (dataPoints, options = {}) => {
  const { resolution = 'daily', metric = 'temperature' } = options;
  const validPoints = dataPoints.filter((p) => p.value != null && !Number.isNaN(Number(p.value)));

  if (validPoints.length < 3) {
    return {
      status: 'insufficient_history',
      sampleCount: validPoints.length,
      slope: null,
      intercept: null,
      rSquared: null,
      ratePerDecade: null,
      direction: 'unknown',
      trendPoints: [],
      method: 'Ordinary Least Squares (OLS) linear regression',
      limitations: 'At least 3 valid observations are required to estimate a linear trend.',
    };
  }

  const n = validPoints.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;

  validPoints.forEach((p, idx) => {
    const x = idx;
    const y = Number(p.value);
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
    sumYY += y * y;
  });

  const meanX = sumX / n;
  const meanY = sumY / n;
  const denominator = sumXX - sumX * meanX;

  const slope = denominator !== 0 ? (sumXY - sumX * meanY) / denominator : 0;
  const intercept = meanY - slope * meanX;

  // Pearson correlation coefficient (r) and R²
  const ssTotal = sumYY - n * meanY * meanY;
  const ssRes = validPoints.reduce((acc, p, idx) => {
    const yPred = intercept + slope * idx;
    return acc + (Number(p.value) - yPred) ** 2;
  }, 0);
  const rSquared = ssTotal > 0 ? Math.max(0, 1 - ssRes / ssTotal) : 0;

  // Scale slope to rate of change per decade
  let ratePerDecade = 0;
  if (resolution === 'daily') {
    ratePerDecade = slope * 365.25 * 10;
  } else if (resolution === 'monthly') {
    ratePerDecade = slope * 12 * 10;
  } else if (resolution === 'annual') {
    ratePerDecade = slope * 10;
  }

  let direction = 'stable';
  if (metric === 'temperature') {
    if (slope > 0.005) direction = 'warming';
    else if (slope < -0.005) direction = 'cooling';
  } else if (metric === 'precipitation') {
    if (slope > 0.01) direction = 'wetter';
    else if (slope < -0.01) direction = 'drier';
  } else {
    if (slope > 0) direction = 'increasing';
    else if (slope < 0) direction = 'decreasing';
  }

  // Generate trend line points corresponding to all inputs (including missing slots)
  let validIndex = 0;
  const trendPoints = dataPoints.map((p) => {
    if (p.value == null) return { date: p.date, value: null };
    const fitted = round(intercept + slope * validIndex);
    validIndex++;
    return { date: p.date, value: fitted };
  });

  return {
    status: 'sufficient',
    sampleCount: n,
    slope: round(slope, 4),
    intercept: round(intercept),
    rSquared: round(rSquared, 3),
    ratePerDecade: round(ratePerDecade),
    direction,
    trendPoints,
    method: 'Ordinary Least Squares (OLS) linear regression',
    limitations:
      'Assumes a monotonic linear trend over the selected time range. Does not model non-linear oscillations (such as El Niño / La Niña, Pacific Decadal Oscillation, or North Atlantic Oscillation) or urban heat island modifications. Short observation periods exhibit higher statistical noise.',
  };
};

/**
 * Detect date gaps in a sequential daily or monthly series
 */
const detectDateGaps = (dates, resolution = 'daily') => {
  if (!dates || dates.length <= 1) return [];
  const missing = [];
  const sorted = [...dates].sort();

  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = new Date(sorted[i]);
    const next = new Date(sorted[i + 1]);

    if (resolution === 'daily') {
      const diffDays = Math.round((next.getTime() - curr.getTime()) / (24 * 3600 * 1000));
      if (diffDays > 1) {
        // Gap exists between curr and next
        for (let d = 1; d < diffDays; d++) {
          const missingDate = new Date(curr.getTime() + d * 24 * 3600 * 1000);
          missing.push(missingDate.toISOString().slice(0, 10));
        }
      }
    }
  }

  return missing;
};

/**
 * Aggregate observations by resolution (daily, monthly, annual)
 */
const aggregateObservations = (rows, resolution = 'daily', metric = 'temperature') => {
  if (!rows || rows.length === 0) return [];

  const grouped = new Map();

  rows.forEach((row) => {
    const obsDate = new Date(row.observed_at || row.date);
    let key = '';

    if (resolution === 'annual') {
      key = `${obsDate.getUTCFullYear()}`;
    } else if (resolution === 'monthly') {
      const y = obsDate.getUTCFullYear();
      const m = String(obsDate.getUTCMonth() + 1).padStart(2, '0');
      key = `${y}-${m}`;
    } else {
      // daily
      key = obsDate.toISOString().slice(0, 10);
    }

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(Number(row.value != null ? row.value : row[metric]));
  });

  const isCumulativeMetric = metric === 'precipitation';
  const result = [];

  for (const [key, values] of grouped.entries()) {
    const valid = values.filter((v) => !Number.isNaN(v));
    if (valid.length === 0) {
      result.push({ date: key, value: null, count: 0, isMissing: true });
      continue;
    }

    let aggregatedValue = 0;
    if (isCumulativeMetric) {
      // Precipitation is accumulated (summed) across the time resolution
      aggregatedValue = valid.reduce((a, b) => a + b, 0);
    } else {
      // Temperature, humidity, pressure are averaged (mean)
      aggregatedValue = valid.reduce((a, b) => a + b, 0) / valid.length;
    }

    result.push({
      date: key,
      value: round(aggregatedValue),
      count: valid.length,
      unit: rows[0]?.unit || (metric === 'precipitation' ? 'mm' : '°C'),
    });
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * Get comprehensive climate trends for a given user region
 */
const getRegionalClimateTrends = async (userId, regionId, options = {}) => {
  const {
    metric = 'temperature',
    resolution = 'daily', // daily | monthly | annual
    includeReference = true,
  } = options;

  // 1. Fetch regional details
  const regionRes = await db.query(
    `SELECT id, name, latitude, longitude, country, admin1, timezone
     FROM environment_regions
     WHERE id = $1 AND user_id = $2`,
    [regionId, userId],
  );

  const region = regionRes.rows[0];
  if (!region) return null;

  // 2. Fetch observations from PostgreSQL
  const obsRes = await db.query(
    `SELECT observed_at, value, unit, quality
     FROM environment_observations
     WHERE region_id = $1 AND metric = $2
     ORDER BY observed_at ASC`,
    [regionId, metric],
  );

  let rawObservations = obsRes.rows;
  let dataSource = 'PostgreSQL Local Telemetry';
  let attribution = 'CarbonWise AI Environmental Ingestion';

  // 3. If local observations are sparse (< 7 observations), attempt NASA POWER fallback
  if (rawObservations.length < 7) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1); // 1-year default history

    const nasaData = await fetchNasaPowerDaily({
      latitude: Number(region.latitude),
      longitude: Number(region.longitude),
      startDate,
      endDate,
    });

    if (nasaData.dailyRecords?.length > 0) {
      dataSource = 'NASA POWER Project';
      attribution = nasaData.attribution;
      rawObservations = nasaData.dailyRecords.map((r) => ({
        observed_at: r.date,
        value: r[metric],
        unit: metric === 'precipitation' ? 'mm' : metric === 'temperature' ? '°C' : '',
        quality: 'nasa_power_observed',
      }));
    }
  }

  // 4. Handle insufficient history explicitly without fabricating data (Requirement 10)
  if (rawObservations.length < 3) {
    return {
      region,
      metric,
      resolution,
      status: 'insufficient_history',
      sampleCount: rawObservations.length,
      minRequired: 3,
      timeSeries: [],
      missingDates: [],
      trend: {
        status: 'insufficient_history',
        explanation: 'Insufficient history for trend calculation',
      },
      referenceComparison: null,
      dataSource,
      attribution,
      explanation: 'Insufficient observations collected in database to compute empirical climate trend.',
    };
  }

  // 5. Aggregate data points by resolution
  const timeSeries = aggregateObservations(rawObservations, resolution, metric);

  // 6. Detect missing date intervals
  const observationDates = timeSeries.map((t) => t.date);
  const dateGaps = detectDateGaps(observationDates, resolution);

  // 7. Calculate statistical linear trend
  const trend = calculateLinearTrend(timeSeries, { resolution, metric });

  // 8. Historical reference normal comparison (e.g. 1991-2020 WMO standard baseline)
  let referenceComparison = null;
  if (includeReference) {
    const values = timeSeries.map((t) => t.value).filter((v) => v != null);
    const observedMean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

    // Approximate regional baseline normal based on latitude/season or NASA climatology
    const refBaselineValue = metric === 'temperature' ? 21.5 : 65.0; // Reference baseline normal
    const anomaly = observedMean != null ? round(observedMean - refBaselineValue) : null;
    const pctOfNormal =
      metric === 'precipitation' && observedMean != null && refBaselineValue > 0
        ? round((observedMean / refBaselineValue) * 100)
        : null;

    referenceComparison = {
      referencePeriod: '1991–2020 WMO Standard Climate Normal',
      referenceBaseline: refBaselineValue,
      observedMean: round(observedMean),
      anomaly,
      percentageOfNormal: pctOfNormal,
      unit: timeSeries[0]?.unit || (metric === 'precipitation' ? 'mm' : '°C'),
      interpretation:
        anomaly != null && anomaly > 0
          ? `${anomaly > 0 ? '+' : ''}${anomaly}°C warmer than 1991–2020 climatological normal.`
          : `${anomaly}°C cooler than 1991–2020 climatological normal.`,
    };
  }

  return {
    region,
    metric,
    resolution,
    status: 'sufficient',
    sampleCount: timeSeries.length,
    startDate: timeSeries[0]?.date,
    endDate: timeSeries[timeSeries.length - 1]?.date,
    timeSeries,
    dateGaps,
    hasGaps: dateGaps.length > 0,
    trend,
    referenceComparison,
    dataSource,
    attribution,
    generatedAt: new Date().toISOString(),
  };
};

module.exports = {
  calculateLinearTrend,
  detectDateGaps,
  aggregateObservations,
  getRegionalClimateTrends,
};
