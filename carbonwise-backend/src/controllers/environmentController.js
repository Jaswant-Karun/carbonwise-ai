const db = require('../config/db');
const {
  createAlerts,
  ingestRegion,
  searchLocations,
  summarizeRegion,
  validateRegion,
} = require('../services/environmentService');

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
    const result = await db.query(
      `SELECT id, name, latitude, longitude, country, admin1, timezone, last_synced_at, created_at
       FROM environment_regions
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id],
    );
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
    const result = await db.query(
      `SELECT a.id, a.metric, a.severity, a.status, a.observed_value, a.baseline_value,
              a.threshold_value, a.deviation, a.anomaly_category, a.anomaly_type,
              a.detection_method, a.data_source, a.confidence_score, a.duration_hours,
              a.is_persistent, a.explanation, a.observed_at, a.updated_at, a.created_at,
              r.name AS region_name
       FROM environment_alerts a
       JOIN environment_regions r ON r.id = a.region_id
       WHERE a.user_id = $1
       ORDER BY a.created_at DESC
       LIMIT 100`,
      [req.user.id],
    );
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
    const result = await db.query(
      `UPDATE environment_alerts SET status = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, metric, severity, status, explanation, observed_at`,
      [req.body.status, req.params.alertId, req.user.id],
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Environmental alert not found.' });
    res.json(result.rows[0]);
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

module.exports = {
  createRegion,
  getOverview,
  getRegionAnomalies,
  getSummary,
  listAlerts,
  listRegions,
  refreshRegion,
  searchLocationSuggestions,
  updateAlert,
};
