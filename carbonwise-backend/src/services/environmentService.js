const db = require('../config/db');
const {
  METRICS,
  SOURCE_DEFINITIONS,
  buildObservations,
  validateRegion,
  round,
  fetchJson,
  searchLocations,
} = require('./environmentUtils');

// 15-minute in-memory response cache to minimize external API roundtrips
const cache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000;

const getCacheKey = (lat, lon, endpoint) =>
  `${round(lat)},${round(lon)}:${endpoint}`;

const ensureSource = async (definition) => {
  const result = await db.query(
    `INSERT INTO environment_sources (name, provider, metric, unit)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (provider, metric) DO UPDATE SET enabled = TRUE
     RETURNING id, name, provider, metric, unit`,
    [definition.name, definition.provider, definition.metric, definition.unit],
  );
  return result.rows[0];
};

/**
 * Fetch and ingest multi-metric live conditions for a region
 */
const ingestRegion = async (region) => {
  const sourceIds = {};
  for (const [key, def] of Object.entries(SOURCE_DEFINITIONS)) {
    const source = await ensureSource(def);
    sourceIds[key] = source.id;
    sourceIds[def.metric] = source.id;
  }

  const weatherCacheKey = getCacheKey(region.latitude, region.longitude, 'weather');
  const airCacheKey = getCacheKey(region.latitude, region.longitude, 'air');

  let weather = cache.get(weatherCacheKey)?.data;
  let airQuality = cache.get(airCacheKey)?.data;

  const now = Date.now();
  const fetches = [];

  if (!weather || now - (cache.get(weatherCacheKey)?.timestamp || 0) > CACHE_TTL_MS) {
    const weatherParams = new URLSearchParams({
      latitude: region.latitude,
      longitude: region.longitude,
      current: 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,surface_pressure',
      hourly: 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,surface_pressure',
      forecast_days: '7',
      timezone: region.timezone || 'UTC',
    });
    fetches.push(
      fetchJson(`https://api.open-meteo.com/v1/forecast?${weatherParams.toString()}`).then((data) => {
        weather = data;
        cache.set(weatherCacheKey, { timestamp: now, data });
      })
    );
  }

  if (!airQuality || now - (cache.get(airCacheKey)?.timestamp || 0) > CACHE_TTL_MS) {
    const airParams = new URLSearchParams({
      latitude: region.latitude,
      longitude: region.longitude,
      current: 'pm2_5,pm10,us_aqi',
      hourly: 'pm2_5,pm10,us_aqi',
      forecast_days: '1',
      timezone: region.timezone || 'UTC',
    });
    fetches.push(
      fetchJson(`https://air-quality-api.open-meteo.com/v1/air-quality?${airParams.toString()}`).then((data) => {
        airQuality = data;
        cache.set(airCacheKey, { timestamp: now, data });
      })
    );
  }

  if (fetches.length > 0) {
    await Promise.all(fetches);
  }

  const observations = buildObservations(weather, airQuality, sourceIds, region.id);

  // Idempotent upsert into PostgreSQL
  for (const obs of observations) {
    await db.query(
      `INSERT INTO environment_observations
       (source_id, region_id, metric, value, unit, observed_at, quality, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, 'observed', $7)
       ON CONFLICT (source_id, region_id, metric, observed_at)
       DO UPDATE SET
         value = EXCLUDED.value,
         ingested_at = CURRENT_TIMESTAMP,
         quality = EXCLUDED.quality,
         metadata = EXCLUDED.metadata`,
      [obs.sourceId, obs.regionId, obs.metric, obs.value, obs.unit, obs.observedAt, obs.metadata],
    );
  }

  // Update last synced timestamp on region
  await db.query(
    'UPDATE environment_regions SET last_synced_at = CURRENT_TIMESTAMP WHERE id = $1',
    [region.id],
  );

  return { observationsCount: observations.length, source: 'open-meteo', cached: fetches.length === 0 };
};

const mean = (values) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null);
const standardDeviation = (values, average) =>
  values.length
    ? Math.sqrt(values.reduce((sum, v) => sum + (v - average) ** 2, 0) / values.length)
    : 0;

const {
  calculateBaseline,
  evaluateDataQuality,
  detectAtmosphericAnomaly,
  persistOrUpdateAlert,
  analyzeRegionAnomalies,
} = require('./climateAnomalyService');

/**
 * Summarize telemetry and historical observations for a user region
 */
const summarizeRegion = async (userId, regionId) => {
  const result = await db.query(
    `SELECT o.id, o.metric, o.value, o.unit, o.observed_at, o.ingested_at, o.quality, o.metadata,
            r.name AS region_name, r.latitude, r.longitude, r.country, r.admin1, r.last_synced_at, s.name AS source_name
     FROM environment_observations o
     JOIN environment_regions r ON r.id = o.region_id
     JOIN environment_sources s ON s.id = o.source_id
     WHERE o.region_id = $1 AND r.user_id = $2
     ORDER BY o.observed_at DESC`,
    [regionId, userId],
  );

  const byMetric = {};
  result.rows.forEach((row) => {
    if (!byMetric[row.metric]) byMetric[row.metric] = [];
    byMetric[row.metric].push(row);
  });

  const metrics = Object.entries(byMetric).map(([metric, rows]) => {
    const latest = rows[0];
    const latestValue = Number(latest.value);
    const freshnessMinutes = latest.ingested_at
      ? Math.max(0, Math.round((Date.now() - new Date(latest.ingested_at).getTime()) / 60000))
      : null;

    // 1. Data Quality and Sensor integrity check
    const qualityCheck = evaluateDataQuality(metric, latestValue, rows, {
      latestObservedAt: latest.observed_at,
    });

    // 2. Baseline calculation (minimum 7 samples required)
    const baselineInfo = calculateBaseline(
      rows,
      latest.observed_at ? new Date(latest.observed_at) : new Date(),
    );

    // 3. Anomaly detection via robust Z-score & seasonal thresholds
    const anomalyInfo = qualityCheck.isValid
      ? detectAtmosphericAnomaly({
          metric,
          observedValue: latestValue,
          unit: latest.unit,
          baselineInfo,
          recentObservations: rows,
        })
      : {
          isAnomaly: false,
          severity: qualityCheck.severity || 'warning',
          anomalyType: qualityCheck.issueType,
          anomalyCategory: 'data_quality',
          explanation: qualityCheck.explanation,
          confidenceScore: qualityCheck.confidenceImpact,
          confidenceLabel: 'low',
        };

    const threshold = baselineInfo.status === 'sufficient'
      ? round(baselineInfo.median + (baselineInfo.robustStdDev * 2))
      : null;

    return {
      metric,
      label: METRICS[metric]?.label || metric,
      unit: latest.unit,
      latest: round(latestValue),
      observedAt: latest.observed_at,
      ingestedAt: latest.ingested_at,
      freshnessMinutes,
      freshness: freshnessMinutes == null ? 'unknown' : freshnessMinutes <= 120 ? 'fresh' : 'stale',
      baseline: baselineInfo.baseline,
      baselineStatus: baselineInfo.status,
      mad: baselineInfo.mad,
      robustStdDev: baselineInfo.robustStdDev,
      deviation: anomalyInfo.deviation ?? null,
      robustZScore: anomalyInfo.robustZScore ?? null,
      threshold,
      anomaly: anomalyInfo.isAnomaly,
      severity: anomalyInfo.severity,
      anomalyType: anomalyInfo.anomalyType,
      anomalyCategory: anomalyInfo.anomalyCategory,
      detectionMethod: anomalyInfo.detectionMethod || 'none',
      durationType: anomalyInfo.durationType || 'short_term',
      isPersistent: anomalyInfo.isPersistent || false,
      confidenceScore: anomalyInfo.confidenceScore,
      confidenceLabel: anomalyInfo.confidenceLabel,
      explanation: baselineInfo.status === 'insufficient_history'
        ? 'Insufficient baseline data'
        : anomalyInfo.explanation,
      qualityCheck,
      observations: rows
        .slice(0, 30)
        .reverse()
        .map((r) => ({
          observedAt: r.observed_at,
          value: round(r.value),
          unit: r.unit,
        })),
    };
  });

  const firstRow = result.rows[0];
  const regionInfo = firstRow
    ? {
        id: regionId,
        name: firstRow.region_name,
        latitude: Number(firstRow.latitude),
        longitude: Number(firstRow.longitude),
        country: firstRow.country,
        admin1: firstRow.admin1,
        lastSyncedAt: firstRow.last_synced_at,
      }
    : null;

  return { region: regionInfo, metrics };
};

/**
 * Generate explainable alerts using deterministic statistical engine with deduplication
 */
const createAlerts = async (userId, summary) => {
  const alerts = [];
  if (!summary?.metrics || !summary?.region) return alerts;

  for (const metric of summary.metrics) {
    if (!metric.anomaly && metric.qualityCheck?.isValid !== false) continue;

    const anomalyPayload = {
      metric: metric.metric,
      observedValue: metric.latest,
      baselineValue: metric.baseline,
      deviation: metric.deviation,
      severity: metric.severity || 'warning',
      isAnomaly: metric.anomaly,
      anomalyCategory: metric.anomalyCategory || (metric.qualityCheck?.isValid === false ? 'data_quality' : 'atmospheric'),
      anomalyType: metric.anomalyType || 'unspecified_anomaly',
      detectionMethod: metric.detectionMethod || 'robust_zscore_mad',
      isPersistent: metric.isPersistent || false,
      confidenceScore: metric.confidenceScore,
      explanation: metric.explanation,
    };

    const saved = await persistOrUpdateAlert(userId, summary.region.id, anomalyPayload, {
      observedAt: metric.observedAt,
      dataSource: 'open-meteo',
    });

    if (saved?.alert) {
      alerts.push(saved.alert);
    }
  }
  return alerts;
};

module.exports = {
  METRICS,
  SOURCE_DEFINITIONS,
  buildObservations,
  validateRegion,
  searchLocations,
  ingestRegion,
  summarizeRegion,
  createAlerts,
  _cache: cache,
};
