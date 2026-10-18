BEGIN;

DROP INDEX IF EXISTS idx_environment_alerts_category_severity_status;

ALTER TABLE environment_alerts
  DROP COLUMN IF EXISTS evidence,
  DROP COLUMN IF EXISTS resolution_history,
  DROP COLUMN IF EXISTS source_url;

DELETE FROM environment_sources WHERE provider = 'openaq';

COMMIT;
