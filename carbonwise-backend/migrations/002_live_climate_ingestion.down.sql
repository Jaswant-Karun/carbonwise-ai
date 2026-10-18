BEGIN;

DROP INDEX IF EXISTS idx_environment_observations_observed_at;
DROP INDEX IF EXISTS idx_environment_ingestion_runs_started_at;

ALTER TABLE environment_regions
  DROP COLUMN IF EXISTS country,
  DROP COLUMN IF EXISTS admin1,
  DROP COLUMN IF EXISTS timezone,
  DROP COLUMN IF EXISTS last_synced_at;

COMMIT;
