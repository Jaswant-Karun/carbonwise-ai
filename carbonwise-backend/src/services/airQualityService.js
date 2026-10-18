const db = require('../config/db');
const { fetchJson } = require('./environmentUtils');

/**
 * Dedicated Air Quality Monitoring & Alert Engine
 * Interfaces with OpenAQ API v3, normalizes pollutant measurements,
 * applies WHO 2021 & US EPA NAAQS health benchmarks, and manages alert resolution history.
 *
 * Attribution:
 * "Data provided by the OpenAQ Community (https://openaq.org) and participating environmental monitoring agencies."
 */

const fetch = global.fetch;

// In-memory 15-minute response cache to respect provider rate limits
const aqCache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000;

const round = (val, dec = 2) => (val == null || Number.isNaN(Number(val)) ? null : Number(Number(val).toFixed(dec)));

// Authoritative Health Guidelines (WHO 2021 Global Air Quality Guidelines & US EPA NAAQS)
const AIR_QUALITY_STANDARDS = {
  pm2_5: {
    unit: 'µg/m³',
    label: 'PM2.5 (Fine Particulate Matter)',
    guideline: 15.0, // WHO 24-hour guideline
    thresholds: {
      good: 12.0,
      moderate: 35.4,
      unhealthySensitive: 55.4,
      unhealthy: 150.4,
      hazardous: 250.0,
    },
    referenceDoc: 'WHO 2021 Air Quality Guidelines / US EPA NAAQS',
  },
  pm10: {
    unit: 'µg/m³',
    label: 'PM10 (Inhalable Particulate Matter)',
    guideline: 45.0, // WHO 24-hour guideline
    thresholds: {
      good: 54.0,
      moderate: 154.0,
      unhealthy: 254.0,
      hazardous: 354.0,
    },
    referenceDoc: 'WHO 2021 Air Quality Guidelines',
  },
  no2: {
    unit: 'µg/m³',
    label: 'Nitrogen Dioxide (NO₂)',
    guideline: 25.0,
    thresholds: {
      good: 53.0,
      moderate: 100.0,
      unhealthy: 360.0,
    },
    referenceDoc: 'WHO 2021 Air Quality Guidelines',
  },
  o3: {
    unit: 'µg/m³',
    label: 'Ozone (O₃)',
    guideline: 100.0,
    thresholds: {
      good: 100.0,
      moderate: 140.0,
      unhealthy: 180.0,
    },
    referenceDoc: 'WHO 2021 Air Quality Guidelines',
  },
  so2: {
    unit: 'µg/m³',
    label: 'Sulfur Dioxide (SO₂)',
    guideline: 40.0,
    thresholds: {
      good: 35.0,
      moderate: 75.0,
      unhealthy: 185.0,
    },
    referenceDoc: 'WHO 2021 Air Quality Guidelines',
  },
  co: {
    unit: 'mg/m³',
    label: 'Carbon Monoxide (CO)',
    guideline: 4.0,
    thresholds: {
      good: 4.4,
      moderate: 9.4,
      unhealthy: 15.4,
    },
    referenceDoc: 'WHO 2021 Air Quality Guidelines',
  },
};

/**
 * Scientifically convert parts-per-million (ppm) to µg/m³ under standard conditions (25°C, 1 atm)
 * Molecular weights: NO2=46.01, O3=48.00, SO2=64.07, CO=28.01
 */
const convertGasPpmToUg = (pollutant, ppmValue) => {
  if (ppmValue == null || Number.isNaN(Number(ppmValue))) return null;
  const molarVolume = 24.45; // Liters per mole at 25°C, 1 atm
  const weights = { no2: 46.01, o3: 48.0, so2: 64.07, co: 28.01 };
  const mw = weights[pollutant.toLowerCase()];
  if (!mw) return ppmValue; // Return unmodified if molecular weight unknown
  // For CO: ppm to mg/m3 -> (ppm * mw) / 24.45
  if (pollutant.toLowerCase() === 'co') {
    return round((ppmValue * mw) / molarVolume);
  }
  // For other gases: ppm to µg/m3 -> (ppm * mw / 24.45) * 1000
  return round(((ppmValue * mw) / molarVolume) * 1000);
};

/**
 * Fetch air quality from OpenAQ API v3
 * Handles authentication headers, missing stations, rate-limits, and attribution.
 */
const fetchOpenAqMeasurements = async (latitude, longitude, radiusMeters = 25000) => {
  const lat = round(latitude, 4);
  const lon = round(longitude, 4);
  const cacheKey = `openaq:${lat},${lon}:${radiusMeters}`;
  const cached = aqCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { ...cached.data, cached: true };
  }

  const apiKey = process.env.OPENAQ_API_KEY;
  const headers = { Accept: 'application/json' };
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  const url = `https://api.openaq.org/v3/locations?coordinates=${lat},${lon}&radius=${radiusMeters}&limit=3`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);

    if (res.status === 401 || res.status === 403) {
      return {
        status: 'auth_required',
        provider: 'openaq',
        stationsCount: 0,
        measurements: [],
        attribution: 'OpenAQ Community (https://openaq.org)',
        sourceUrl: 'https://openaq.org',
        message: 'OpenAQ API key required or unauthorized. Add OPENAQ_API_KEY in backend environment.',
      };
    }

    if (res.status === 429) {
      return {
        status: 'rate_limited',
        provider: 'openaq',
        stationsCount: 0,
        measurements: [],
        attribution: 'OpenAQ Community (https://openaq.org)',
        sourceUrl: 'https://openaq.org',
        message: 'OpenAQ API rate limit reached. Respecting provider quota.',
      };
    }

    if (!res.ok) {
      throw new Error(`OpenAQ API HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    const locations = json.results || [];

    if (locations.length === 0) {
      // Requirement 9: Show "Data unavailable" when no station exists rather than treating missing data as clean air
      return {
        status: 'data_unavailable',
        provider: 'openaq',
        stationsCount: 0,
        measurements: [],
        attribution: 'OpenAQ Community (https://openaq.org)',
        sourceUrl: 'https://openaq.org',
        message: 'Data unavailable: No suitable ground monitoring station found within 25 km radius.',
      };
    }

    const nearestStation = locations[0];
    const measurements = [];

    // Parse sensors / parameters reported by the nearest station
    (nearestStation.sensors || []).forEach((sensor) => {
      const paramName = (sensor.parameter?.name || '').toLowerCase().replace('.', '_');
      const latestVal = sensor.latest?.value;
      const rawUnit = sensor.parameter?.units || 'µg/m³';

      if (latestVal != null && !Number.isNaN(Number(latestVal)) && AIR_QUALITY_STANDARDS[paramName]) {
        let normalizedValue = Number(latestVal);
        let standardUnit = AIR_QUALITY_STANDARDS[paramName].unit;

        // Scientific normalization: if reported in ppm/ppb, convert while retaining original
        if (rawUnit.toLowerCase() === 'ppm' || rawUnit.toLowerCase() === 'ppb') {
          const ppm = rawUnit.toLowerCase() === 'ppb' ? latestVal / 1000 : latestVal;
          normalizedValue = convertGasPpmToUg(paramName, ppm);
        }

        measurements.push({
          pollutant: paramName,
          label: AIR_QUALITY_STANDARDS[paramName].label,
          value: round(normalizedValue),
          unit: standardUnit,
          originalValue: round(Number(latestVal)),
          originalUnit: rawUnit,
          observedAt: sensor.latest?.datetime || new Date().toISOString(),
          stationId: nearestStation.id,
          stationName: nearestStation.name || 'Ground Monitoring Station',
          sourceUrl: `https://openaq.org/stations/${nearestStation.id}`,
        });
      }
    });

    const result = {
      status: measurements.length > 0 ? 'available' : 'data_unavailable',
      provider: 'openaq',
      stationId: nearestStation.id,
      stationName: nearestStation.name || 'Ground Monitoring Station',
      stationsCount: locations.length,
      measurements,
      attribution: 'Data provided by OpenAQ Community (https://openaq.org)',
      sourceUrl: `https://openaq.org/stations/${nearestStation.id}`,
      message:
        measurements.length > 0
          ? `Connected to OpenAQ station: ${nearestStation.name}`
          : 'Data unavailable: Monitoring station is currently inactive or reports no supported pollutants.',
    };

    aqCache.set(cacheKey, { timestamp: Date.now(), data: result });
    return result;
  } catch (error) {
    console.warn(`OpenAQ API request deferred (${error.message}).`);
    return {
      status: 'provider_unavailable',
      provider: 'openaq',
      stationsCount: 0,
      measurements: [],
      error: error.message,
      attribution: 'OpenAQ Community (https://openaq.org)',
      sourceUrl: 'https://openaq.org',
      message: 'Data unavailable: OpenAQ service temporarily unreachable.',
    };
  }
};

/**
 * Evaluate air quality thresholds against WHO and EPA guidelines
 * Strictly separates ambient air pollution from climate change declarations
 */
const evaluateAirQualityThresholds = (pollutant, value, unit) => {
  const std = AIR_QUALITY_STANDARDS[pollutant];
  if (!std) {
    return { isExceeded: false, severity: 'normal', explanation: `${pollutant} monitored nominal.` };
  }

  const numVal = Number(value);
  const thresholds = std.thresholds;
  let severity = 'normal';
  let isExceeded = false;
  let categoryLabel = 'Good';

  if (thresholds.hazardous && numVal >= thresholds.hazardous) {
    severity = 'critical';
    isExceeded = true;
    categoryLabel = 'Hazardous';
  } else if (thresholds.unhealthy && numVal >= thresholds.unhealthy) {
    severity = 'critical';
    isExceeded = true;
    categoryLabel = 'Unhealthy';
  } else if (thresholds.unhealthySensitive && numVal >= thresholds.unhealthySensitive) {
    severity = 'warning';
    isExceeded = true;
    categoryLabel = 'Unhealthy for Sensitive Groups';
  } else if (thresholds.moderate && numVal >= thresholds.moderate) {
    severity = 'info';
    isExceeded = true;
    categoryLabel = 'Moderate';
  }

  // Factual, authoritative explanation without claiming civil emergency
  let explanation = '';
  if (!isExceeded) {
    explanation = `${std.label} concentration of ${numVal} ${unit} is within clean air guidelines (${std.referenceDoc}).`;
  } else {
    explanation = `${std.label} observed at ${numVal} ${unit} (${categoryLabel}). Concentration exceeds the WHO guideline reference threshold of ${std.guideline} ${unit}. Sensitive individuals should consider reducing prolonged outdoor exertion.`;
  }

  return {
    pollutant,
    label: std.label,
    value: numVal,
    unit,
    guideline: std.guideline,
    categoryLabel,
    severity,
    isExceeded,
    explanation,
    referenceDoc: std.referenceDoc,
  };
};

/**
 * Persist or update Air Quality Alerts with resolution history and deduplication
 */
const storeAirQualityAlert = async (userId, regionId, evaluation, stationInfo = {}) => {
  if (!evaluation.isExceeded) return null;

  const observedAt = stationInfo.observedAt || new Date().toISOString();
  const sourceUrl = stationInfo.sourceUrl || 'https://openaq.org';
  const dataSource = stationInfo.stationName ? `OpenAQ: ${stationInfo.stationName}` : 'OpenAQ Air Quality';

  const evidence = {
    pollutant: evaluation.pollutant,
    label: evaluation.label,
    observedValue: evaluation.value,
    thresholdGuideline: evaluation.guideline,
    categoryLabel: evaluation.categoryLabel,
    standard: evaluation.referenceDoc,
    stationName: stationInfo.stationName || 'Regional Air Monitor',
    stationId: stationInfo.stationId || null,
    sourceUrl,
  };

  // Check for open continuing alert for this pollutant and user
  const existingRes = await db.query(
    `SELECT id, severity, observed_value, threshold_value, explanation, duration_hours,
            resolution_history, observed_at
     FROM environment_alerts
     WHERE user_id = $1 AND region_id = $2 AND metric = $3
       AND anomaly_category = 'air_quality' AND status = 'open'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, regionId, evaluation.pollutant],
  );

  const existing = existingRes.rows[0];

  if (existing) {
    const prevTime = new Date(existing.observed_at).getTime();
    const currTime = new Date(observedAt).getTime();
    const elapsedHours = Math.max(1, Math.round((currTime - prevTime) / 3600000));

    // Deduplicate continuing event if within 24 hours
    if (elapsedHours <= 24) {
      const updatedDuration = (existing.duration_hours || 1) + elapsedHours;
      const severityRank = { info: 1, warning: 2, critical: 3 };
      const currentRank = severityRank[existing.severity] || 1;
      const newRank = severityRank[evaluation.severity] || 1;
      const updatedSeverity = newRank > currentRank ? evaluation.severity : existing.severity;

      const updateRes = await db.query(
        `UPDATE environment_alerts
         SET observed_value = $1,
             duration_hours = $2,
             severity = $3,
             explanation = $4,
             evidence = $5,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6
         RETURNING id, metric, severity, status, observed_value, threshold_value,
                   anomaly_category, duration_hours, explanation, observed_at,
                   evidence, resolution_history, source_url`,
        [
          evaluation.value,
          updatedDuration,
          updatedSeverity,
          `${evaluation.explanation} (Ongoing pollution event: active for ${updatedDuration}h).`,
          JSON.stringify(evidence),
          existing.id,
        ],
      );
      return { alert: updateRes.rows[0], deduplicated: true };
    }
  }

  // Insert new alert record
  const insertRes = await db.query(
    `INSERT INTO environment_alerts
     (user_id, region_id, metric, severity, status, observed_value, threshold_value,
      anomaly_category, anomaly_type, detection_method, data_source, confidence_score,
      duration_hours, explanation, observed_at, evidence, resolution_history, source_url)
     VALUES ($1, $2, $3, $4, 'open', $5, $6, 'air_quality', $7, 'who_naaqs_threshold', $8, 1.0, 1, $9, $10, $11, '[]'::jsonb, $12)
     RETURNING id, metric, severity, status, observed_value, threshold_value,
               anomaly_category, anomaly_type, duration_hours, explanation,
               observed_at, evidence, resolution_history, source_url, created_at`,
    [
      userId,
      regionId,
      evaluation.pollutant,
      evaluation.severity,
      evaluation.value,
      evaluation.guideline,
      `air_pollution_${evaluation.pollutant}`,
      dataSource,
      evaluation.explanation,
      observedAt,
      JSON.stringify(evidence),
      sourceUrl,
    ],
  );

  return { alert: insertRes.rows[0], deduplicated: false };
};

/**
 * Update alert status and record resolution history
 */
const updateAlertStatusWithHistory = async (alertId, userId, newStatus, note = '') => {
  const allowed = new Set(['open', 'acknowledged', 'resolved']);
  if (!allowed.has(newStatus)) {
    throw new Error('Invalid alert status. Must be open, acknowledged, or resolved.');
  }

  const existingRes = await db.query(
    `SELECT id, status, resolution_history FROM environment_alerts WHERE id = $1 AND user_id = $2`,
    [alertId, userId],
  );

  const existing = existingRes.rows[0];
  if (!existing) return null;

  const history = Array.isArray(existing.resolution_history) ? existing.resolution_history : [];
  history.push({
    timestamp: new Date().toISOString(),
    previousStatus: existing.status,
    newStatus,
    note: note || `Alert marked as ${newStatus}`,
    userId,
  });

  const updateRes = await db.query(
    `UPDATE environment_alerts
     SET status = $1,
         resolution_history = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3 AND user_id = $4
     RETURNING id, metric, severity, status, explanation, observed_at, resolution_history, updated_at`,
    [newStatus, JSON.stringify(history), alertId, userId],
  );

  return updateRes.rows[0];
};

module.exports = {
  AIR_QUALITY_STANDARDS,
  convertGasPpmToUg,
  fetchOpenAqMeasurements,
  evaluateAirQualityThresholds,
  storeAirQualityAlert,
  updateAlertStatusWithHistory,
  _aqCache: aqCache,
};
