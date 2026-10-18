BEGIN;

-- Enhance environment_alerts table with statistical detection and explainability columns
ALTER TABLE environment_alerts
  ADD COLUMN IF NOT EXISTS anomaly_category VARCHAR(40) DEFAULT 'atmospheric',
  ADD COLUMN IF NOT EXISTS anomaly_type VARCHAR(60),
  ADD COLUMN IF NOT EXISTS deviation DECIMAL(14, 4),
  ADD COLUMN IF NOT EXISTS detection_method VARCHAR(80),
  ADD COLUMN IF NOT EXISTS data_source VARCHAR(100) DEFAULT 'open-meteo',
  ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(5, 2) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS duration_hours INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_persistent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Index for efficient alert deduplication on ongoing events
CREATE INDEX IF NOT EXISTS idx_environment_alerts_dedup
  ON environment_alerts (user_id, region_id, metric, anomaly_category, status);

CREATE INDEX IF NOT EXISTS idx_environment_alerts_observed_at
  ON environment_alerts (observed_at DESC);

COMMIT;
