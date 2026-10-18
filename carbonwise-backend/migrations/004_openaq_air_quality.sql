BEGIN;

-- Add evidence, resolution history, and source URL tracking to environment_alerts
ALTER TABLE environment_alerts
  ADD COLUMN IF NOT EXISTS evidence JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS resolution_history JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_url VARCHAR(300);

-- Register OpenAQ pollutant sources
INSERT INTO environment_sources (name, provider, metric, unit)
VALUES
  ('OpenAQ Air Quality', 'openaq', 'pm2_5', 'µg/m³'),
  ('OpenAQ Air Quality', 'openaq', 'pm10', 'µg/m³'),
  ('OpenAQ Air Quality', 'openaq', 'no2', 'µg/m³'),
  ('OpenAQ Air Quality', 'openaq', 'o3', 'µg/m³'),
  ('OpenAQ Air Quality', 'openaq', 'so2', 'µg/m³'),
  ('OpenAQ Air Quality', 'openaq', 'co', 'mg/m³')
ON CONFLICT (provider, metric) DO UPDATE SET enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_environment_alerts_category_severity_status
  ON environment_alerts (user_id, anomaly_category, severity, status, created_at DESC);

COMMIT;
