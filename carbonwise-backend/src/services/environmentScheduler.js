const db = require('../config/db');
const { ingestRegion, summarizeRegion, createAlerts } = require('./environmentService');

let timer = null;
let isRunning = false;

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const MIN_INTERVAL_MS = 60 * 1000;          // 1 minute

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getIntervalMs = () => {
  const envVal = Number(process.env.ENVIRONMENT_SYNC_INTERVAL_MS);
  if (Number.isFinite(envVal) && envVal >= MIN_INTERVAL_MS) {
    return envVal;
  }
  return DEFAULT_INTERVAL_MS;
};

/**
 * Execute a synchronized ingestion pass over all registered regions
 */
const runSyncPass = async () => {
  if (isRunning) {
    console.info('[scheduler] Ingestion pass already in progress. Skipping duplicate tick.');
    return;
  }
  isRunning = true;
  console.info('[scheduler] Starting periodic climate ingestion cycle...');

  try {
    const regionsResult = await db.query(
      `SELECT id, user_id, name, latitude, longitude, country, admin1, timezone, last_synced_at
       FROM environment_regions
       ORDER BY last_synced_at ASC NULLS FIRST`
    );

    const regions = regionsResult.rows;
    if (!regions.length) {
      console.info('[scheduler] No environmental regions configured yet.');
      return;
    }

    // Pre-resolve weather source for ingestion runs
    const sourceRes = await db.query(
      `INSERT INTO environment_sources (name, provider, metric, unit)
       VALUES ('Open-Meteo Weather', 'open-meteo', 'temperature', '°C')
       ON CONFLICT (provider, metric) DO UPDATE SET enabled = TRUE
       RETURNING id`
    );
    const sourceId = sourceRes.rows[0].id;

    let totalIngested = 0;

    for (const region of regions) {
      const runRes = await db.query(
        `INSERT INTO environment_ingestion_runs (source_id, region_id, status)
         VALUES ($1, $2, 'running')
         RETURNING id`,
        [sourceId, region.id],
      );
      const runId = runRes.rows[0]?.id;

      try {
        const result = await ingestRegion(region);
        totalIngested += result.observationsCount;

        await db.query(
          `UPDATE environment_ingestion_runs
           SET status = 'completed', observations_count = $1, completed_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [result.observationsCount, runId],
        );

        // Run anomaly check & alerts for this region
        const summary = await summarizeRegion(region.user_id, region.id);
        await createAlerts(region.user_id, summary);

        console.info(`[scheduler] Ingested ${result.observationsCount} points for "${region.name}"`);
      } catch (err) {
        console.warn(`[scheduler] Failed ingestion for region "${region.name}":`, err.code || err.message);
        await db.query(
          `UPDATE environment_ingestion_runs
           SET status = 'failed', error_code = $1, completed_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [err.code || 'provider_error', runId],
        );
      }

      // Rate limit protection: 1-second pause between regions to prevent burst throttling
      await sleep(1000);
    }

    console.info(`[scheduler] Ingestion cycle completed. Total observations updated: ${totalIngested}`);
  } catch (err) {
    console.error('[scheduler] Ingestion pass error:', err.message);
  } finally {
    isRunning = false;
  }
};

/**
 * Start background scheduler
 */
const startScheduler = () => {
  if (timer) return;
  const intervalMs = getIntervalMs();
  console.info(`[scheduler] Climate data ingestion scheduled every ${Math.round(intervalMs / 60000)} minutes.`);

  // Initial pass shortly after boot
  setTimeout(() => {
    runSyncPass().catch((e) => console.error('[scheduler] Initial sync error:', e));
  }, 5000);

  timer = setInterval(() => {
    runSyncPass().catch((e) => console.error('[scheduler] Scheduled sync error:', e));
  }, intervalMs);
};

/**
 * Stop background scheduler
 */
const stopScheduler = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.info('[scheduler] Ingestion scheduler stopped.');
  }
};

module.exports = {
  startScheduler,
  stopScheduler,
  runSyncPass,
  getIntervalMs,
};
