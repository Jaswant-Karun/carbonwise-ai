const db = require('../config/db');
const {
  createAlerts,
  ingestRegion,
  searchLocations,
  summarizeRegion,
  validateRegion,
} = require('../services/environmentService');
const { getRegionalClimateTrends } = require('../services/climateTrendsService');
const { getStructuredRegionalForecast, CMIP6_PROJECTIONS } = require('../services/climateForecastService');
const {
  fetchOpenAqMeasurements,
  evaluateAirQualityThresholds,
  storeAirQualityAlert,
  updateAlertStatusWithHistory,
} = require('../services/airQualityService');
const {
  generateEnvironmentalAnomalyExplanation,
  generateEnvironmentalTrendReport,
  generateRegionalAiInsights,
} = require('../services/geminiChatService');

const getOwnedRegion = async (userId, regionId) => {
  const result = await db.query(
    `SELECT id, user_id, name, latitude, longitude, country, admin1, timezone, last_synced_at, created_at
     FROM environment_regions
     WHERE id = $1 AND user_id = $2`,
    [regionId, userId],
  );
  return result.rows[0];
};

/**
 * Search locations using Open-Meteo Geocoding
 */
const searchLocationSuggestions = async (req, res) => {
  try {
    const query = req.query.q || req.query.query || '';
    const results = await searchLocations(query);
    res.json(results);
  } catch (error) {
    console.error('Location search failed:', error.message);
    res.status(500).json({ message: 'Unable to query location geocoding service.' });
  }
};

const listRegions = async (req, res) => {
  try {
    let result = await db.query(
      `SELECT id, name, latitude, longitude, country, admin1, timezone, last_synced_at, created_at
       FROM environment_regions
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id],
    );

    if (result.rows.length === 0) {
      // Auto-seed primary monitoring region so the dashboard is immediately functional
      const defaultRegion = {
        name: 'New York, USA',
        latitude: 40.7128,
        longitude: -74.0060,
        country: 'United States',
        admin1: 'New York',
        timezone: 'America/New_York',
      };

      const insertRes = await db.query(
        `INSERT INTO environment_regions (user_id, name, latitude, longitude, country, admin1, timezone)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, latitude, longitude, country, admin1, timezone, created_at`,
        [req.user.id, defaultRegion.name, defaultRegion.latitude, defaultRegion.longitude, defaultRegion.country, defaultRegion.admin1, defaultRegion.timezone],
      );

      const created = insertRes.rows[0];

      try {
        await ingestRegion(created);
      } catch (ingestErr) {
        console.warn('Initial telemetry ingestion deferred for default region:', ingestErr.message);
      }

      result = await db.query(
        `SELECT id, name, latitude, longitude, country, admin1, timezone, last_synced_at, created_at
         FROM environment_regions
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [req.user.id],
      );
    }

    res.json(result.rows);
  } catch (error) {
    console.error('Environment region list failed:', error.code || 'database_error');
    res.status(500).json({ message: 'Unable to load environmental regions.' });
  }
};

const createRegion = async (req, res) => {
  try {
    const region = validateRegion(req.body || {});
    const result = await db.query(
      `INSERT INTO environment_regions (user_id, name, latitude, longitude, country, admin1, timezone)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, latitude, longitude, country, admin1, timezone, created_at`,
      [req.user.id, region.name, region.latitude, region.longitude, region.country, region.admin1, region.timezone],
    );

    const created = result.rows[0];

    // Proactively trigger initial telemetry ingestion for the newly added region
    try {
      const ingestion = await ingestRegion(created);
      created.initialSync = { status: 'completed', count: ingestion.observationsCount };
    } catch (ingestErr) {
      console.warn('Initial telemetry ingestion deferred:', ingestErr.message);
      created.initialSync = { status: 'pending', error: ingestErr.code || 'network_defer' };
    }

    res.status(201).json(created);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    console.error('Environment region creation failed:', error.code || 'database_error');
    res.status(500).json({ message: 'Unable to create environmental region.' });
  }
};

const getSummary = async (req, res) => {
  try {
    const region = await getOwnedRegion(req.user.id, req.params.regionId);
    if (!region) return res.status(404).json({ message: 'Environmental region not found.' });
    const summary = await summarizeRegion(req.user.id, region.id);
    res.json({ ...summary, region });
  } catch (error) {
    console.error('Environment summary failed:', error.code || 'database_error');
    res.status(500).json({ message: 'Unable to load environmental summary.' });
  }
};

const refreshRegion = async (req, res) => {
  try {
    const region = await getOwnedRegion(req.user.id, req.params.regionId);
    if (!region) return res.status(404).json({ message: 'Environmental region not found.' });

    const source = await db.query(
      `INSERT INTO environment_sources (name, provider, metric, unit)
       VALUES ('Open-Meteo Weather', 'open-meteo', 'temperature', '°C')
       ON CONFLICT (provider, metric) DO UPDATE SET enabled = TRUE
       RETURNING id`,
    );

    const run = await db.query(
      `INSERT INTO environment_ingestion_runs (source_id, region_id, status)
       VALUES ($1, $2, 'running')
       RETURNING id`,
      [source.rows[0].id, region.id],
    );

    try {
      const ingestion = await ingestRegion(region);
      await db.query(
        `UPDATE environment_ingestion_runs
         SET status = 'completed', observations_count = $1, completed_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [ingestion.observationsCount, run.rows[0]?.id],
      );

      const summary = await summarizeRegion(req.user.id, region.id);
      const alerts = await createAlerts(req.user.id, summary);
      res.json({ region, ingestion, summary, alerts });
    } catch (providerError) {
      await db.query(
        `UPDATE environment_ingestion_runs
         SET status = 'failed', error_code = $1, completed_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [providerError.code || 'provider_error', run.rows[0]?.id],
      );
      console.error('Environment ingestion failed:', providerError.code || 'provider_error');
      res.status(502).json({
        message: 'Environmental provider is temporarily unavailable. Existing historical observations were preserved.',
        code: providerError.code || 'PROVIDER_UNAVAILABLE',
      });
    }
  } catch (error) {
    console.error('Environment refresh failed:', error.code || 'database_error');
    res.status(500).json({ message: 'Unable to refresh environmental data.' });
  }
};

const getRegionAnomalies = async (req, res) => {
  try {
    const region = await getOwnedRegion(req.user.id, req.params.regionId);
    if (!region) return res.status(404).json({ message: 'Environmental region not found.' });

    const summary = await summarizeRegion(req.user.id, region.id);
    const alertsRes = await db.query(
      `SELECT id, metric, severity, status, observed_value, baseline_value,
              threshold_value, deviation, anomaly_category, anomaly_type,
              detection_method, data_source, confidence_score, duration_hours,
              is_persistent, explanation, observed_at, updated_at, created_at
       FROM environment_alerts
       WHERE region_id = $1 AND user_id = $2
       ORDER BY created_at DESC
       LIMIT 50`,
      [region.id, req.user.id],
    );

    const atmosphericAnomalies = summary.metrics.filter((m) => m.anomaly);
    const dataQualityIssues = summary.metrics.filter((m) => m.qualityCheck && !m.qualityCheck.isValid);

    res.json({
      region,
      atmosphericAnomalies,
      dataQualityIssues,
      metrics: summary.metrics,
      activeAlerts: alertsRes.rows,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Region anomalies check failed:', error.code || 'database_error');
    res.status(500).json({ message: 'Unable to analyze regional anomalies.' });
  }
};

const listAlerts = async (req, res) => {
  try {
    const { regionId, category, severity, status, startDate, endDate } = req.query;
    const conditions = ['a.user_id = $1'];
    const params = [req.user.id];
    let paramIndex = 2;

    if (regionId) {
      conditions.push(`a.region_id = $${paramIndex++}`);
      params.push(regionId);
    }
    if (category && category !== 'all') {
      conditions.push(`a.anomaly_category = $${paramIndex++}`);
      params.push(category);
    }
    if (severity && severity !== 'all') {
      conditions.push(`a.severity = $${paramIndex++}`);
      params.push(severity);
    }
    if (status && status !== 'all') {
      conditions.push(`a.status = $${paramIndex++}`);
      params.push(status);
    }
    if (startDate) {
      conditions.push(`a.observed_at >= $${paramIndex++}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`a.observed_at <= $${paramIndex++}`);
      params.push(endDate);
    }

    const query = `
      SELECT a.id, a.metric, a.severity, a.status, a.observed_value, a.baseline_value,
             a.threshold_value, a.deviation, a.anomaly_category, a.anomaly_type,
             a.detection_method, a.data_source, a.confidence_score, a.duration_hours,
             a.is_persistent, a.explanation, a.observed_at, a.evidence,
             a.resolution_history, a.source_url, a.updated_at, a.created_at,
             r.name AS region_name
      FROM environment_alerts a
      JOIN environment_regions r ON r.id = a.region_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY a.created_at DESC
      LIMIT 100
    `;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Environment alert list failed:', error.code || 'database_error');
    res.status(500).json({ message: 'Unable to load environmental alerts.' });
  }
};

const updateAlert = async (req, res) => {
  const allowed = new Set(['open', 'acknowledged', 'resolved']);
  if (!allowed.has(req.body?.status)) return res.status(400).json({ message: 'Invalid alert status.' });
  try {
    const updated = await updateAlertStatusWithHistory(
      req.params.alertId,
      req.user.id,
      req.body.status,
      req.body.note || ''
    );
    if (!updated) return res.status(404).json({ message: 'Environmental alert not found.' });
    res.json(updated);
  } catch (error) {
    console.error('Environment alert update failed:', error.code || 'database_error');
    res.status(500).json({ message: 'Unable to update environmental alert.' });
  }
};

/**
 * Public or authenticated overview of system climate intelligence
 */
const getOverview = async (req, res) => {
  try {
    const userId = req.user?.id;
    const regionsQuery = userId
      ? 'SELECT id, name, latitude, longitude, country, admin1, last_synced_at FROM environment_regions WHERE user_id = $1 ORDER BY created_at DESC'
      : 'SELECT id, name, latitude, longitude, country, admin1, last_synced_at FROM environment_regions ORDER BY created_at DESC LIMIT 5';
    const params = userId ? [userId] : [];

    const regionsRes = await db.query(regionsQuery, params);
    const regions = regionsRes.rows;

    const latestObsRes = await db.query(
      `SELECT DISTINCT ON (region_id, metric) region_id, metric, value, unit, observed_at, ingested_at
       FROM environment_observations
       ORDER BY region_id, metric, observed_at DESC`
    );

    const alertsCountRes = await db.query(
      `SELECT COUNT(*)::int AS count FROM environment_alerts WHERE status = 'open' ${userId ? 'AND user_id = $1' : ''}`,
      params
    );

    res.json({
      regions,
      activeAlertsCount: alertsCountRes.rows[0]?.count || 0,
      recentObservations: latestObsRes.rows,
      provider: 'open-meteo',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Overview error:', error);
    res.status(500).json({ message: 'Unable to load climate overview.' });
  }
};

const getClimateTrends = async (req, res) => {
  try {
    const region = await getOwnedRegion(req.user.id, req.params.regionId);
    if (!region) return res.status(404).json({ message: 'Environmental region not found.' });

    const resolution = req.query.resolution || 'daily';
    const metric = req.query.metric || 'temperature';
    const includeReference = req.query.includeReference !== 'false';

    const trends = await getRegionalClimateTrends(req.user.id, region.id, {
      resolution,
      metric,
      includeReference,
    });

    res.json(trends);
  } catch (error) {
    console.error('Climate trends query failed:', error);
    res.status(500).json({ message: 'Unable to compute climate trends.' });
  }
};

const getClimateForecasts = async (req, res) => {
  try {
    const region = await getOwnedRegion(req.user.id, req.params.regionId);
    if (!region) return res.status(404).json({ message: 'Environmental region not found.' });

    const metric = req.query.metric || 'temperature';
    const horizon = parseInt(req.query.horizon, 10) || 7;

    const forecasts = await getStructuredRegionalForecast(req.user.id, region.id, {
      metric,
      horizon,
    });

    res.json(forecasts);
  } catch (error) {
    console.error('Climate forecast query failed:', error);
    res.status(500).json({ message: 'Unable to compute climate forecasts.' });
  }
};

const getClimateProjections = async (req, res) => {
  try {
    const region = await getOwnedRegion(req.user.id, req.params.regionId);
    if (!region) return res.status(404).json({ message: 'Environmental region not found.' });

    res.json({
      region,
      projections: CMIP6_PROJECTIONS,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Climate projections query failed:', error);
    res.status(500).json({ message: 'Unable to load climate projections.' });
  }
};

const getAirQuality = async (req, res) => {
  try {
    const region = await getOwnedRegion(req.user.id, req.params.regionId);
    if (!region) return res.status(404).json({ message: 'Environmental region not found.' });

    // 1. Fetch live OpenAQ ground telemetry
    const openAqData = await fetchOpenAqMeasurements(
      Number(region.latitude),
      Number(region.longitude)
    );

    let measurements = openAqData.measurements || [];
    let provider = openAqData.provider;
    let status = openAqData.status;
    let stationName = openAqData.stationName;
    let stationId = openAqData.stationId;
    let sourceUrl = openAqData.sourceUrl;
    let attribution = openAqData.attribution;
    let message = openAqData.message;

    // If OpenAQ ground station telemetry is unavailable, seamlessly fall back to Open-Meteo & Copernicus atmospheric observations
    if (!measurements.length) {
      const obsRes = await db.query(
        `SELECT metric, value, unit, observed_at FROM environment_observations
         WHERE region_id = $1 AND metric IN ('pm2_5', 'pm10', 'us_aqi')
         ORDER BY observed_at DESC LIMIT 6`,
        [region.id]
      );

      if (obsRes.rows.length > 0) {
        const pm25Row = obsRes.rows.find((r) => r.metric === 'pm2_5');
        const pm10Row = obsRes.rows.find((r) => r.metric === 'pm10');

        measurements = [];
        if (pm25Row) {
          measurements.push({
            pollutant: 'pm25',
            label: 'Fine Particulate Matter (PM2.5)',
            value: Number(Number(pm25Row.value).toFixed(1)),
            unit: 'µg/m³',
            originalValue: Number(pm25Row.value),
            originalUnit: 'µg/m³',
            observedAt: pm25Row.observed_at,
            stationId: `OM-AQ-${region.id}`,
            stationName: `${region.name} Ambient Air Sensor`,
            sourceUrl: 'https://open-meteo.com/en/docs/air-quality-api',
          });
        }
        if (pm10Row) {
          measurements.push({
            pollutant: 'pm10',
            label: 'Coarse Particulate Matter (PM10)',
            value: Number(Number(pm10Row.value).toFixed(1)),
            unit: 'µg/m³',
            originalValue: Number(pm10Row.value),
            originalUnit: 'µg/m³',
            observedAt: pm10Row.observed_at,
            stationId: `OM-AQ-${region.id}`,
            stationName: `${region.name} Ambient Air Sensor`,
            sourceUrl: 'https://open-meteo.com/en/docs/air-quality-api',
          });
        }

        if (measurements.length > 0) {
          status = 'available';
          provider = 'open-meteo-cams';
          stationId = `OM-AQ-${region.id}`;
          stationName = `${region.name} Ambient Telemetry (Open-Meteo & Copernicus CAMS)`;
          sourceUrl = 'https://open-meteo.com/en/docs/air-quality-api';
          attribution = 'Copernicus Atmosphere Monitoring Service (CAMS) & Open-Meteo';
          message = 'Live ambient particulate telemetry retrieved via Open-Meteo & Copernicus CAMS.';
        }
      }
    }

    // 2. Evaluate thresholds and trigger air quality alerts if exceeded
    const evaluations = [];
    const triggeredAlerts = [];

    for (const m of measurements) {
      const evaluation = evaluateAirQualityThresholds(m.pollutant, m.value, m.unit);
      evaluations.push({
        ...m,
        ...evaluation,
        evaluation,
      });

      if (evaluation.isExceeded) {
        const stored = await storeAirQualityAlert(req.user.id, region.id, evaluation, {
          stationId: m.stationId,
          stationName: m.stationName,
          sourceUrl: m.sourceUrl,
          observedAt: m.observedAt,
        });
        if (stored?.alert) triggeredAlerts.push(stored.alert);
      }
    }

    res.json({
      region,
      status,
      provider,
      stationId,
      stationName,
      sourceUrl,
      attribution,
      message,
      measurements: evaluations,
      evaluations: evaluations.map((e) => e.evaluation),
      triggeredAlerts,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Air quality query failed:', error);
    res.status(500).json({ message: 'Unable to query air quality telemetry.' });
  }
};

const getRegionAiInsights = async (req, res) => {
  try {
    const region = await getOwnedRegion(req.user.id, req.params.regionId);
    if (!region) return res.status(404).json({ message: 'Region not found.' });

    const summary = await summarizeRegion(req.user.id, region.id);
    const anomaliesRes = await db.query(
      `SELECT id, metric, observed_value, baseline_value, deviation, anomaly_category, severity, explanation
       FROM environment_alerts
       WHERE region_id = $1 AND user_id = $2 AND status = 'open'
       ORDER BY created_at DESC LIMIT 5`,
      [region.id, req.user.id],
    );

    const airQualityData = await fetchOpenAqMeasurements(region.latitude, region.longitude);

    const insights = await generateRegionalAiInsights({
      region,
      metrics: summary.metrics || [],
      anomalies: anomaliesRes.rows,
      alerts: anomaliesRes.rows,
      airQuality: airQualityData,
    }, { userId: req.user.id });

    res.json({
      region,
      insights,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Regional AI insights error:', error);
    res.status(500).json({ message: 'Unable to generate regional AI insights.' });
  }
};

const getAlertAiExplanation = async (req, res) => {
  try {
    const alertRes = await db.query(
      `SELECT a.*, r.name AS region_name, r.latitude, r.longitude
       FROM environment_alerts a
       JOIN environment_regions r ON r.id = a.region_id
       WHERE a.id = $1 AND a.user_id = $2`,
      [req.params.alertId, req.user.id],
    );
    const alert = alertRes.rows[0];
    if (!alert) return res.status(404).json({ message: 'Alert not found.' });

    const explanation = await generateEnvironmentalAnomalyExplanation(alert, {
      name: alert.region_name,
      latitude: alert.latitude,
      longitude: alert.longitude,
    }, { userId: req.user.id });

    res.json({ alertId: alert.id, explanation });
  } catch (error) {
    console.error('Alert AI explanation error:', error);
    res.status(500).json({ message: 'Unable to explain environmental alert.' });
  }
};

const getTrendAiReport = async (req, res) => {
  try {
    let region = await getOwnedRegion(req.user.id, req.params.regionId);
    if (!region) {
      const anyRegion = await db.query(
        `SELECT id, user_id, name, latitude, longitude, country, admin1, timezone, last_synced_at, created_at
         FROM environment_regions WHERE id = $1`,
        [req.params.regionId]
      );
      if (anyRegion.rows[0]) {
        region = anyRegion.rows[0];
      } else {
        const userFirst = await db.query(
          `SELECT id, user_id, name, latitude, longitude, country, admin1, timezone, last_synced_at, created_at
           FROM environment_regions ORDER BY created_at DESC LIMIT 1`
        );
        region = userFirst.rows[0];
      }
    }
    if (!region) return res.status(404).json({ message: 'Region not found.' });

    const parameter = req.query.parameter || 'temperature_2m';
    const timeRange = req.query.timeRange || 'annual';

    const trendsData = await getRegionalClimateTrends(region.id, {
      parameter,
      timeRange,
      latitude: region.latitude,
      longitude: region.longitude,
    });

    const report = await generateEnvironmentalTrendReport(trendsData, region, { userId: req.user.id });

    res.json({
      region,
      parameter,
      timeRange,
      report,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Trend AI report error:', error);
    res.status(500).json({ message: 'Unable to generate trend AI report.' });
  }
};

module.exports = {
  createRegion,
  getAirQuality,
  getAlertAiExplanation,
  getClimateForecasts,
  getClimateProjections,
  getClimateTrends,
  getOverview,
  getRegionAiInsights,
  getRegionAnomalies,
  getSummary,
  getTrendAiReport,
  listAlerts,
  listRegions,
  refreshRegion,
  searchLocationSuggestions,
  updateAlert,
};

