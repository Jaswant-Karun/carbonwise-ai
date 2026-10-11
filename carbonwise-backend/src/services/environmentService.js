const db = require('../config/db');

const METRICS = {
  temperature: { unit: '°C', label: 'Temperature', endpoint: 'weather' },
  pm2_5: { unit: 'µg/m³', label: 'PM2.5', endpoint: 'air_quality' },
  us_aqi: { unit: 'AQI', label: 'US AQI', endpoint: 'air_quality' },
};

const SOURCE_DEFINITIONS = {
  weather: { name: 'Open-Meteo Weather', provider: 'open-meteo', metric: 'temperature', unit: '°C' },
  air_quality: { name: 'Open-Meteo Air Quality', provider: 'open-meteo', metric: 'pm2_5', unit: 'µg/m³' },
};

const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const validateRegion = ({ name, latitude, longitude }) => {
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!normalizedName || normalizedName.length > 120) throw Object.assign(new Error('Region name is required.'), { statusCode: 400 });
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw Object.assign(new Error('Latitude must be between -90 and 90.'), { statusCode: 400 });
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) throw Object.assign(new Error('Longitude must be between -180 and 180.'), { statusCode: 400 });
  return { name: normalizedName, latitude: round(lat), longitude: round(lon) };
};

const fetchJson = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const error = new Error(`Environmental provider returned HTTP ${response.status}.`);
      error.code = `HTTP_${response.status}`;
      throw error;
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
};

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

const buildObservations = (weather, airQuality, sourceIds, regionId) => {
  const observations = [];
  const weatherTimes = weather?.hourly?.time || [];
  const weatherValues = weather?.hourly?.temperature_2m || [];
  if (weatherTimes.length && weatherValues.length) {
    const index = weatherTimes.length - 1;
    observations.push({
      sourceId: sourceIds.weather,
      regionId,
      metric: 'temperature',
      value: Number(weatherValues[index]),
      unit: METRICS.temperature.unit,
      observedAt: weatherTimes[index],
      metadata: { source: 'open-meteo', variable: 'temperature_2m' },
    });
  }
  const airTimes = airQuality?.hourly?.time || [];
  const pmValues = airQuality?.hourly?.pm2_5 || [];
  const aqiValues = airQuality?.hourly?.us_aqi || [];
  if (airTimes.length && pmValues.length) {
    const index = airTimes.length - 1;
    observations.push({
      sourceId: sourceIds.airQuality,
      regionId,
      metric: 'pm2_5',
      value: Number(pmValues[index]),
      unit: METRICS.pm2_5.unit,
      observedAt: airTimes[index],
      metadata: { source: 'open-meteo', variable: 'pm2_5' },
    });
    if (aqiValues.length && Number.isFinite(Number(aqiValues[index]))) {
      observations.push({
        sourceId: sourceIds.airQuality,
        regionId,
        metric: 'us_aqi',
        value: Number(aqiValues[index]),
        unit: METRICS.us_aqi.unit,
        observedAt: airTimes[index],
        metadata: { source: 'open-meteo', variable: 'us_aqi' },
      });
    }
  }
  return observations.filter((item) => Number.isFinite(item.value));
};

const ingestRegion = async (region) => {
  const weatherSource = await ensureSource(SOURCE_DEFINITIONS.weather);
  const airSource = await ensureSource(SOURCE_DEFINITIONS.air_quality);
  const query = `latitude=${encodeURIComponent(region.latitude)}&longitude=${encodeURIComponent(region.longitude)}&forecast_days=1&hourly=temperature_2m&timezone=UTC`;
  const airQuery = `latitude=${encodeURIComponent(region.latitude)}&longitude=${encodeURIComponent(region.longitude)}&forecast_days=1&hourly=pm2_5,us_aqi&timezone=UTC`;
  const [weather, airQuality] = await Promise.all([
    fetchJson(`https://api.open-meteo.com/v1/forecast?${query}`),
    fetchJson(`https://air-quality-api.open-meteo.com/v1/air-quality?${airQuery}`),
  ]);
  const observations = buildObservations(weather, airQuality, { weather: weatherSource.id, airQuality: airSource.id }, region.id);
  for (const observation of observations) {
    await db.query(
      `INSERT INTO environment_observations
       (source_id, region_id, metric, value, unit, observed_at, quality, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, 'observed', $7)
       ON CONFLICT (source_id, region_id, metric, observed_at)
       DO UPDATE SET value = EXCLUDED.value, ingested_at = CURRENT_TIMESTAMP, metadata = EXCLUDED.metadata`,
      [observation.sourceId, observation.regionId, observation.metric, observation.value, observation.unit, observation.observedAt, observation.metadata],
    );
  }
  return { observationsCount: observations.length, source: 'open-meteo' };
};

const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const standardDeviation = (values, average) => values.length
  ? Math.sqrt(values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / values.length)
  : 0;

const summarizeRegion = async (userId, regionId) => {
  const result = await db.query(
    `SELECT o.id, o.metric, o.value, o.unit, o.observed_at, o.quality, o.metadata,
            r.name AS region_name, s.name AS source_name
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
    const values = rows.slice(0, 30).map((row) => Number(row.value));
    const average = mean(values);
    const deviation = standardDeviation(values, average || 0);
    const latest = rows[0];
    const threshold = average == null ? null : round(average + Math.max(deviation * 2, average * 0.5));
    return {
      metric,
      label: METRICS[metric]?.label || metric,
      unit: latest.unit,
      latest: round(latest.value),
      observedAt: latest.observed_at,
      baseline: average == null ? null : round(average),
      threshold,
      anomaly: threshold != null && Number(latest.value) >= threshold && values.length >= 3,
      observations: rows.slice(0, 30).reverse().map((row) => ({
        observedAt: row.observed_at,
        value: round(row.value),
        unit: row.unit,
      })),
    };
  });
  return { region: result.rows[0] ? { id: regionId, name: result.rows[0].region_name } : null, metrics };
};

const createAlerts = async (userId, summary) => {
  const alerts = [];
  for (const metric of summary.metrics) {
    if (!metric.anomaly) continue;
    const severity = metric.metric === 'us_aqi' && metric.latest >= 150 ? 'critical' : 'warning';
    const explanation = `${metric.label} is ${metric.latest} ${metric.unit}, above the ${metric.threshold} ${metric.unit} rule threshold based on recent observations.`;
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
      [userId, summary.region.id, metric.metric, severity, metric.latest, metric.baseline, metric.threshold, explanation, metric.observedAt],
    );
    if (result.rows[0]) alerts.push(result.rows[0]);
  }
  return alerts;
};

module.exports = {
  METRICS,
  SOURCE_DEFINITIONS,
  buildObservations,
  createAlerts,
  ingestRegion,
  summarizeRegion,
  validateRegion,
};
