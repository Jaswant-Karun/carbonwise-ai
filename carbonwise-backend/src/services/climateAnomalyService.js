const db = require('../config/db');

/**
 * Deterministic Climate & Environmental Anomaly Detection Engine
 * Uses robust statistical baselines (Median & Median Absolute Deviation [MAD], robust Z-scores),
 * physical plausibility bounds, and temporal aggregation without fabricated data.
 */

const MIN_BASELINE_SAMPLES = 7;
const ROBUST_Z_NORMAL = 2.0;
const ROBUST_Z_WARNING = 2.8;
const ROBUST_Z_CRITICAL = 3.8;

// Physical plausibility limits for sensor telemetry
const PHYSICAL_BOUNDS = {
  temperature: { min: -60, max: 60, unit: '°C' },
  relative_humidity: { min: 0, max: 100, unit: '%' },
  precipitation: { min: 0, max: 300, unit: 'mm' },
  wind_speed: { min: 0, max: 350, unit: 'km/h' },
  surface_pressure: { min: 850, max: 1090, unit: 'hPa' },
  pm2_5: { min: 0, max: 1000, unit: 'µg/m³' },
  pm10: { min: 0, max: 1500, unit: 'µg/m³' },
  us_aqi: { min: 0, max: 500, unit: 'AQI' },
};

/**
 * Round utility to fixed decimals
 */
const round = (val, decimals = 2) => {
  if (val == null || Number.isNaN(Number(val))) return null;
  return Number(Number(val).toFixed(decimals));
};

/**
 * Compute median of a numerical array
 */
const median = (values) => {
  if (!values || values.length === 0) return null;
  const sorted = [...values].filter((v) => v != null && !Number.isNaN(Number(v))).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Compute Median Absolute Deviation (MAD)
 * MAD = median(|x_i - median(X)|)
 */
const medianAbsoluteDeviation = (values, med = null) => {
  if (!values || values.length === 0) return null;
  const valid = values.filter((v) => v != null && !Number.isNaN(Number(v)));
  if (valid.length === 0) return null;
  const m = med !== null ? med : median(valid);
  if (m === null) return null;
  const absDeviations = valid.map((v) => Math.abs(v - m));
  return median(absDeviations);
};

/**
 * Compute percentile of a sorted numerical array
 */
const percentile = (sortedValues, p) => {
  if (!sortedValues || sortedValues.length === 0) return null;
  if (p <= 0) return sortedValues[0];
  if (p >= 100) return sortedValues[sortedValues.length - 1];
  const index = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
};

/**
 * Determine meteorological season for a given date
 * Dec-Feb: winter, Mar-May: spring, Jun-Aug: summer, Sep-Nov: autumn
 */
const getSeason = (dateInput) => {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const month = d.getUTCMonth(); // 0 to 11
  if (month === 11 || month === 0 || month === 1) return 'winter';
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  return 'autumn';
};

/**
 * Validate sensor / provider observation quality
 * Separates data quality defects from true environmental anomalies
 */
const evaluateDataQuality = (metric, latestValue, historyRows = [], options = {}) => {
  const issues = [];
  const numVal = Number(latestValue);
  const bounds = PHYSICAL_BOUNDS[metric];

  // 1. Missing or NaN check
  if (latestValue == null || Number.isNaN(numVal)) {
    return {
      isValid: false,
      category: 'data_quality',
      issueType: 'missing_value',
      severity: 'warning',
      explanation: `Missing or unparseable telemetry value for ${metric}.`,
      confidenceImpact: 0.0,
    };
  }

  // 2. Physical plausibility check
  if (bounds) {
    if (numVal < bounds.min || numVal > bounds.max) {
      return {
        isValid: false,
        category: 'data_quality',
        issueType: 'implausible_value',
        severity: 'critical',
        explanation: `Physically implausible reading of ${numVal} ${bounds.unit} for ${metric} (expected valid atmospheric range: ${bounds.min} to ${bounds.max} ${bounds.unit}). Possible sensor or provider error.`,
        confidenceImpact: 0.2,
      };
    }
  }

  // 3. Flatline / Frozen sensor check (4+ identical values in a row with expected non-zero variance)
  // Temperature, humidity, pressure, wind should fluctuate naturally
  const fluctuatingMetrics = ['temperature', 'relative_humidity', 'surface_pressure', 'wind_speed'];
  if (fluctuatingMetrics.includes(metric) && historyRows.length >= 4) {
    const recentValues = historyRows.slice(0, 4).map((r) => Number(r.value || r));
    const allIdentical = recentValues.every((v) => !Number.isNaN(v) && v === recentValues[0]);
    if (allIdentical) {
      return {
        isValid: false,
        category: 'data_quality',
        issueType: 'flatline_sensor',
        severity: 'warning',
        explanation: `Potential sensor flatline detected: identical value of ${numVal} repeated across 4 consecutive readings for ${metric}.`,
        confidenceImpact: 0.3,
      };
    }
  }

  // 4. Staleness check
  if (options.latestObservedAt) {
    const elapsedMinutes = Math.round((Date.now() - new Date(options.latestObservedAt).getTime()) / 60000);
    if (elapsedMinutes > 120) {
      issues.push({
        issueType: 'stale_feed',
        severity: 'info',
        explanation: `Observation is ${elapsedMinutes} minutes old (exceeds 120-minute freshness threshold).`,
        confidenceImpact: 0.7,
      });
    }
  }

  return {
    isValid: true,
    category: 'valid',
    issues,
    confidenceImpact: 1.0,
  };
};

/**
 * Calculate historical baseline for a given metric and dataset
 * Supports seasonal / calendar grouping and robust statistics
 */
const calculateBaseline = (observations, targetDate = new Date(), options = {}) => {
  const { seasonFilter = true } = options;
  const targetSeason = getSeason(targetDate);

  // Filter observations by season or calendar month where requested
  let relevantRows = observations;
  if (seasonFilter && observations.length >= MIN_BASELINE_SAMPLES * 2) {
    const seasonalRows = observations.filter((obs) => {
      const obsDate = obs.observed_at ? new Date(obs.observed_at) : new Date(obs.observedAt);
      return getSeason(obsDate) === targetSeason;
    });
    // If enough seasonal samples exist, prefer seasonal subset
    if (seasonalRows.length >= MIN_BASELINE_SAMPLES) {
      relevantRows = seasonalRows;
    }
  }

  const values = relevantRows
    .map((r) => (typeof r === 'number' ? r : Number(r.value)))
    .filter((v) => v != null && !Number.isNaN(v));

  // Requirement 9: Insufficient baseline data check
  if (values.length < MIN_BASELINE_SAMPLES) {
    return {
      status: 'insufficient_history',
      sampleCount: values.length,
      minRequired: MIN_BASELINE_SAMPLES,
      season: targetSeason,
      baseline: null,
      mad: null,
      robustStdDev: null,
      confidenceScore: 0.0,
      confidenceLabel: 'insufficient',
      explanation: 'Insufficient baseline data',
    };
  }

  const med = median(values);
  const mad = medianAbsoluteDeviation(values, med);

  // Consistent estimator of standard deviation under normal distribution
  // Minimum dispersion floor avoids division by zero for constant or zero-sparse series
  const dispersionFloor = 0.5;
  const robustStdDev = Math.max(1.4826 * (mad || 0), dispersionFloor);

  const sorted = [...values].sort((a, b) => a - b);
  const p10 = percentile(sorted, 10);
  const p90 = percentile(sorted, 90);
  const p95 = percentile(sorted, 95);

  // Confidence based on sample size: 7-19 -> moderate, 20+ -> high
  let confidenceScore = Math.min(1.0, 0.5 + (values.length / 40) * 0.5);
  confidenceScore = round(confidenceScore);
  const confidenceLabel = confidenceScore >= 0.85 ? 'high' : 'moderate';

  return {
    status: 'sufficient',
    sampleCount: values.length,
    minRequired: MIN_BASELINE_SAMPLES,
    season: targetSeason,
    baseline: round(med),
    median: round(med),
    mad: round(mad),
    robustStdDev: round(robustStdDev),
    p10: round(p10),
    p90: round(p90),
    p95: round(p95),
    confidenceScore,
    confidenceLabel,
    explanation: `Calculated from ${values.length} observations during ${targetSeason} calendar baseline.`,
  };
};

/**
 * Detect environmental atmospheric anomalies using robust Z-score & seasonal thresholds
 */
const detectAtmosphericAnomaly = ({ metric, observedValue, unit, baselineInfo, recentObservations = [] }) => {
  const numObs = Number(observedValue);

  // If baseline is insufficient, return explicit insufficient state without fabricating
  if (!baselineInfo || baselineInfo.status !== 'sufficient') {
    return {
      metric,
      observedValue: round(numObs),
      baselineValue: null,
      deviation: null,
      robustZScore: null,
      isAnomaly: false,
      severity: 'normal',
      anomalyType: 'none',
      anomalyCategory: 'atmospheric',
      detectionMethod: 'none',
      confidenceScore: 0.0,
      confidenceLabel: 'insufficient',
      status: 'insufficient_history',
      explanation: 'Insufficient baseline data to evaluate environmental anomaly.',
    };
  }

  const med = baselineInfo.median;
  const robustStdDev = baselineInfo.robustStdDev;
  const deviation = round(numObs - med);
  const zScore = round((numObs - med) / robustStdDev);
  const absZ = Math.abs(zScore);

  let isAnomaly = false;
  let severity = 'normal';
  let anomalyType = 'none';
  let detectionMethod = 'robust_zscore_mad';

  // Evaluate metric-specific anomaly conditions
  if (metric === 'temperature') {
    if (zScore >= ROBUST_Z_NORMAL) {
      isAnomaly = true;
      anomalyType = 'temperature_heat_anomaly';
      if (absZ >= ROBUST_Z_CRITICAL || numObs >= 40) severity = 'critical';
      else if (absZ >= ROBUST_Z_WARNING || numObs >= 35) severity = 'warning';
      else severity = 'info';
    } else if (zScore <= -ROBUST_Z_NORMAL) {
      isAnomaly = true;
      anomalyType = 'temperature_cold_anomaly';
      if (absZ >= ROBUST_Z_CRITICAL || numObs <= -15) severity = 'critical';
      else if (absZ >= ROBUST_Z_WARNING || numObs <= 0) severity = 'warning';
      else severity = 'info';
    }
  } else if (metric === 'precipitation') {
    // Precipitation anomaly: test both robust seasonal percentile (P95) and extreme precipitation
    detectionMethod = 'seasonal_percentile_threshold';
    const isExtremeRain = numObs >= 50;
    const isHeavyRain = numObs >= 25 || (baselineInfo.p95 && numObs > baselineInfo.p95 && numObs >= 10);
    const isModerateAnomaly = numObs >= 10 && zScore >= ROBUST_Z_NORMAL;

    if (isExtremeRain) {
      isAnomaly = true;
      severity = 'critical';
      anomalyType = 'extreme_precipitation_hazard';
    } else if (isHeavyRain) {
      isAnomaly = true;
      severity = 'warning';
      anomalyType = 'unusual_heavy_precipitation';
    } else if (isModerateAnomaly) {
      isAnomaly = true;
      severity = 'info';
      anomalyType = 'elevated_precipitation';
    }
  } else if (metric === 'us_aqi') {
    // Air quality anomaly: combine EPA health categories with local baseline shift
    if (numObs > 200 || absZ >= ROBUST_Z_CRITICAL) {
      isAnomaly = true;
      severity = 'critical';
      anomalyType = 'hazardous_air_quality';
    } else if (numObs > 150 || absZ >= ROBUST_Z_WARNING) {
      isAnomaly = true;
      severity = 'warning';
      anomalyType = 'unhealthy_air_quality';
    } else if (numObs > 100 || (absZ >= ROBUST_Z_NORMAL && numObs >= 50)) {
      isAnomaly = true;
      severity = 'info';
      anomalyType = 'elevated_air_pollution';
    }
  } else if (metric === 'wind_speed') {
    if (numObs >= 75 || absZ >= ROBUST_Z_CRITICAL) {
      isAnomaly = true;
      severity = 'critical';
      anomalyType = 'severe_wind_hazard';
    } else if (numObs >= 50 || absZ >= ROBUST_Z_WARNING) {
      isAnomaly = true;
      severity = 'warning';
      anomalyType = 'high_wind_advisory';
    } else if (absZ >= ROBUST_Z_NORMAL) {
      isAnomaly = true;
      severity = 'info';
      anomalyType = 'unusual_wind_speed';
    }
  } else {
    // Generic robust Z-score for relative_humidity, pm2_5, pm10, surface_pressure
    if (absZ >= ROBUST_Z_CRITICAL) {
      isAnomaly = true;
      severity = 'critical';
      anomalyType = `${metric}_critical_deviation`;
    } else if (absZ >= ROBUST_Z_WARNING) {
      isAnomaly = true;
      severity = 'warning';
      anomalyType = `${metric}_warning_deviation`;
    } else if (absZ >= ROBUST_Z_NORMAL) {
      isAnomaly = true;
      severity = 'info';
      anomalyType = `${metric}_minor_deviation`;
    }
  }

  // Requirement 3 & 8: Distinguish short-term weather anomalies from persistent long-term trends
  // Do NOT declare climate change based on a single observation or short-term event
  let durationType = 'short_term';
  let isPersistent = false;

  if (recentObservations && recentObservations.length >= 12) {
    // Trailing 24 hours moving average check (or last 24 records)
    const trailingValues = recentObservations.slice(0, 24).map((r) => Number(r.value || r));
    const trailingMed = median(trailingValues);
    const trailingZ = trailingMed !== null ? round((trailingMed - med) / robustStdDev) : 0;

    if (Math.abs(trailingZ) >= ROBUST_Z_NORMAL) {
      durationType = 'persistent_trend';
      isPersistent = true;
    }
  }

  // Build transparent, explainable narrative without hallucinated declarations
  let explanation = '';
  if (!isAnomaly) {
    explanation = `${metric} is within expected seasonal baseline range (${numObs} ${unit || ''}, baseline: ${med} ${unit || ''}, Z-score: ${zScore}).`;
  } else if (isPersistent) {
    explanation = `Persistent environmental anomaly: ${metric} observed at ${numObs} ${unit || ''} (deviation of ${deviation > 0 ? '+' : ''}${deviation} ${unit || ''}, robust Z: ${zScore}). Sustained over multiple observation intervals; indicates an extended regional atmospheric event rather than isolated noise. Note: Local weather persistence requires multi-year observation before attributing to secular climate change.`;
  } else {
    explanation = `Short-term weather anomaly: ${metric} observed at ${numObs} ${unit || ''} (deviation of ${deviation > 0 ? '+' : ''}${deviation} ${unit || ''}, robust Z: ${zScore}). Represented as an acute short-term meteorological spike; this single event does not declare permanent climate change.`;
  }

  return {
    metric,
    observedValue: round(numObs),
    baselineValue: round(med),
    deviation,
    robustZScore: zScore,
    isAnomaly,
    severity,
    anomalyType,
    anomalyCategory: 'atmospheric',
    detectionMethod,
    durationType,
    isPersistent,
    confidenceScore: baselineInfo.confidenceScore,
    confidenceLabel: baselineInfo.confidenceLabel,
    status: 'detected',
    explanation,
  };
};

/**
 * Persist or update anomaly alerts with deduplication for continuing events
 * Prevents duplicate alerts if an open alert exists for the same user, region, and metric
 */
const persistOrUpdateAlert = async (userId, regionId, anomalyData, options = {}) => {
  if (!anomalyData.isAnomaly && anomalyData.category !== 'data_quality') {
    return null;
  }

  const metric = anomalyData.metric;
  const category = anomalyData.anomalyCategory || anomalyData.category || 'atmospheric';
  const observedAt = options.observedAt || new Date().toISOString();
  const dataSource = options.dataSource || 'open-meteo';

  // Check for existing active/open alert for this region, metric, and category
  const existingRes = await db.query(
    `SELECT id, severity, observed_value, baseline_value, deviation, explanation,
            duration_hours, is_persistent, observed_at, created_at
     FROM environment_alerts
     WHERE user_id = $1 AND region_id = $2 AND metric = $3
       AND anomaly_category = $4 AND status = 'open'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, regionId, metric, category],
  );

  const existing = existingRes.rows[0];

  if (existing) {
    // Calculate elapsed hours between previous observation and current
    const prevTime = new Date(existing.observed_at).getTime();
    const currTime = new Date(observedAt).getTime();
    const elapsedHours = Math.max(1, Math.round((currTime - prevTime) / 3600000));

    // If within 24 hours, treat as an ongoing continuing event (deduplicate)
    if (elapsedHours <= 24) {
      const updatedDuration = (existing.duration_hours || 1) + elapsedHours;
      const isPersistent = updatedDuration >= 24 || anomalyData.isPersistent;

      // Escalate severity if new observation is worse
      const severityRank = { info: 1, warning: 2, critical: 3 };
      const currentRank = severityRank[existing.severity] || 1;
      const newRank = severityRank[anomalyData.severity] || 1;
      const updatedSeverity = newRank > currentRank ? anomalyData.severity : existing.severity;

      const updatedExplanation = isPersistent
        ? `${anomalyData.explanation} (Continuing event: active for ${updatedDuration} hours).`
        : anomalyData.explanation;

      const updateRes = await db.query(
        `UPDATE environment_alerts
         SET observed_value = $1,
             deviation = $2,
             duration_hours = $3,
             is_persistent = $4,
             severity = $5,
             explanation = $6,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $7
         RETURNING id, metric, severity, status, observed_value, baseline_value,
                   deviation, anomaly_category, anomaly_type, duration_hours,
                   is_persistent, explanation, observed_at, updated_at`,
        [
          anomalyData.observedValue,
          anomalyData.deviation,
          updatedDuration,
          isPersistent,
          updatedSeverity,
          updatedExplanation,
          existing.id,
        ],
      );

      return { alert: updateRes.rows[0], deduplicated: true };
    }
  }

  // Otherwise, insert new alert record
  const insertRes = await db.query(
    `INSERT INTO environment_alerts
     (user_id, region_id, metric, severity, status, observed_value, baseline_value,
      threshold_value, deviation, anomaly_category, anomaly_type, detection_method,
      data_source, confidence_score, duration_hours, is_persistent, explanation, observed_at)
     VALUES ($1, $2, $3, $4, 'open', $5, $6, $7, $8, $9, $10, $11, $12, $13, 1, $14, $15, $16)
     RETURNING id, metric, severity, status, observed_value, baseline_value,
               deviation, anomaly_category, anomaly_type, detection_method,
               duration_hours, is_persistent, explanation, observed_at, created_at`,
    [
      userId,
      regionId,
      metric,
      anomalyData.severity,
      anomalyData.observedValue,
      anomalyData.baselineValue,
      anomalyData.baselineValue != null ? anomalyData.baselineValue : null,
      anomalyData.deviation,
      category,
      anomalyData.anomalyType,
      anomalyData.detectionMethod || 'robust_zscore_mad',
      dataSource,
      anomalyData.confidenceScore || 1.0,
      anomalyData.isPersistent || false,
      anomalyData.explanation,
      observedAt,
    ],
  );

  return { alert: insertRes.rows[0], deduplicated: false };
};

/**
 * End-to-end regional telemetry analysis
 * Analyzes all metrics, evaluates data quality and baselines, produces explainable anomalies
 */
const analyzeRegionAnomalies = (metricObservationsMap, options = {}) => {
  const analysisResults = {};
  const activeAnomalies = [];
  const dataQualityIssues = [];

  for (const [metric, rows] of Object.entries(metricObservationsMap)) {
    if (!rows || rows.length === 0) continue;

    const latest = rows[0];
    const latestValue = Number(latest.value);
    const unit = latest.unit;
    const observedAt = latest.observed_at || latest.observedAt;

    // 1. Data Quality and Sensor integrity check
    const qualityCheck = evaluateDataQuality(metric, latestValue, rows, { latestObservedAt: observedAt });
    if (!qualityCheck.isValid) {
      dataQualityIssues.push({
        metric,
        ...qualityCheck,
        observedValue: latestValue,
        observedAt,
        unit,
      });
      analysisResults[metric] = {
        metric,
        quality: qualityCheck,
        baseline: null,
        anomaly: null,
      };
      continue;
    }

    // 2. Historical baseline calculation
    const baseline = calculateBaseline(rows, observedAt ? new Date(observedAt) : new Date(), options);

    // 3. Atmospheric anomaly evaluation
    const anomaly = detectAtmosphericAnomaly({
      metric,
      observedValue: latestValue,
      unit,
      baselineInfo: baseline,
      recentObservations: rows,
    });

    if (anomaly.isAnomaly) {
      activeAnomalies.push({
        ...anomaly,
        regionId: options.regionId,
        observedAt,
        unit,
      });
    }

    analysisResults[metric] = {
      metric,
      latestValue: round(latestValue),
      unit,
      observedAt,
      quality: qualityCheck,
      baseline,
      anomaly,
    };
  }

  return {
    metrics: analysisResults,
    activeAnomalies,
    dataQualityIssues,
    hasAnomalies: activeAnomalies.length > 0,
    hasDataQualityIssues: dataQualityIssues.length > 0,
  };
};

module.exports = {
  MIN_BASELINE_SAMPLES,
  ROBUST_Z_NORMAL,
  ROBUST_Z_WARNING,
  ROBUST_Z_CRITICAL,
  PHYSICAL_BOUNDS,
  round,
  median,
  medianAbsoluteDeviation,
  percentile,
  getSeason,
  evaluateDataQuality,
  calculateBaseline,
  detectAtmosphericAnomaly,
  persistOrUpdateAlert,
  analyzeRegionAnomalies,
};
