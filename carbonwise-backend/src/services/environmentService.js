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
    const values = rows.slice(0, 30).map((r) => Number(r.value));
    const average = mean(values);
    const deviation = standardDeviation(values, average || 0);
    const latest = rows[0];

    // Anomaly threshold
    const threshold =
      average == null ? null : round(average + Math.max(deviation * 2, Math.abs(average) * 0.5));

    const freshnessMinutes = latest.ingested_at
      ? Math.max(0, Math.round((Date.now() - new Date(latest.ingested_at).getTime()) / 60000))
      : null;

    return {
      metric,
      label: METRICS[metric]?.label || metric,
      unit: latest.unit,
      latest: round(latest.value),
      observedAt: latest.observed_at,
      ingestedAt: latest.ingested_at,
      freshnessMinutes,
      freshness: freshnessMinutes == null ? 'unknown' : freshnessMinutes <= 120 ? 'fresh' : 'stale',
      baseline: average == null ? null : round(average),
      threshold,
      anomaly: threshold != null && Number(latest.value) >= threshold && values.length >= 3,
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
 * Generate rule-based early warnings when metrics exceed anomaly thresholds
 */
const createAlerts = async (userId, summary) => {
  const alerts = [];
  if (!summary?.metrics || !summary?.region) return alerts;

  for (const metric of summary.metrics) {
    if (!metric.anomaly) continue;

    let severity = 'warning';
    if (metric.metric === 'us_aqi' && metric.latest >= 150) severity = 'critical';
    if (metric.metric === 'temperature' && metric.latest >= 38) severity = 'critical';
    if (metric.metric === 'precipitation' && metric.latest >= 50) severity = 'critical';

    const explanation = `${metric.label} observed at ${metric.latest} ${metric.unit}, exceeding anomalous baseline threshold of ${metric.threshold} ${metric.unit}.`;

    const result = await db.query(
      `INSERT INTO environment_alerts
       (user_id, region_id, metric, severity, observed_value, baseline_value, threshold_value, explanation, observed_at)
       SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9
       WHERE NOT EXISTS (
         SELECT 1 FROM environment_alerts
         WHERE user_id = $1 AND region_id = $2 AND metric = $3
           AND observed_at = $9
       )
       RETURNING id, metric, severity, explanation, observed_at`,
      [
        userId,
        summary.region.id,
        metric.metric,
        severity,
        metric.latest,
        metric.baseline,
        metric.threshold,
        explanation,
        metric.observedAt,
      ],
    );

    if (result.rows[0]) alerts.push(result.rows[0]);
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
