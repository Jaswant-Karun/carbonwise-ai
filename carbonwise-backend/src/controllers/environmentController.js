const db = require('../config/db');
const {
  createAlerts,
  ingestRegion,
  summarizeRegion,
  validateRegion,
} = require('../services/environmentService');

const getOwnedRegion = async (userId, regionId) => {
  const result = await db.query(
    'SELECT id, user_id, name, latitude, longitude, created_at FROM environment_regions WHERE id = $1 AND user_id = $2',
    [regionId, userId],
  );
  return result.rows[0];
};

const listRegions = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, latitude, longitude, created_at FROM environment_regions WHERE user_id = $1 ORDER BY created_at DESC',
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
      `INSERT INTO environment_regions (user_id, name, latitude, longitude)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, latitude, longitude, created_at`,
      [req.user.id, region.name, region.latitude, region.longitude],
    );
    res.status(201).json(result.rows[0]);
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
    const run = await db.query(
      `INSERT INTO environment_ingestion_runs (source_id, region_id, status)
       SELECT id, $1, 'running' FROM environment_sources
       WHERE provider = 'open-meteo' AND metric = 'temperature'
       RETURNING id`,
      [region.id],
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
      res.status(502).json({ message: 'Environmental provider is unavailable. Existing observations were preserved.' });
    }
  } catch (error) {
    console.error('Environment refresh failed:', error.code || 'database_error');
    res.status(500).json({ message: 'Unable to refresh environmental data.' });
  }
};

const listAlerts = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.id, a.metric, a.severity, a.status, a.observed_value, a.baseline_value,
              a.threshold_value, a.explanation, a.observed_at, a.created_at, r.name AS region_name
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

module.exports = {
  createRegion,
  getSummary,
  listAlerts,
  listRegions,
  refreshRegion,
  updateAlert,
};
