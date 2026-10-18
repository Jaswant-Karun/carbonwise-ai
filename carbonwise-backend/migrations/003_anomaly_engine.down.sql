BEGIN;

DROP INDEX IF EXISTS idx_environment_alerts_dedup;
DROP INDEX IF EXISTS idx_environment_alerts_observed_at;

ALTER TABLE environment_alerts
  DROP COLUMN IF EXISTS anomaly_category,
  DROP COLUMN IF EXISTS anomaly_type,
  DROP COLUMN IF EXISTS deviation,
  DROP COLUMN IF EXISTS detection_method,
  DROP COLUMN IF EXISTS data_source,
  DROP COLUMN IF EXISTS confidence_score,
  DROP COLUMN IF EXISTS duration_hours,
  DROP COLUMN IF EXISTS is_persistent,
  DROP COLUMN IF EXISTS updated_at;

COMMIT;
