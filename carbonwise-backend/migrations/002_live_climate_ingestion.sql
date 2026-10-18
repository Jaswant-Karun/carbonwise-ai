BEGIN;

-- Add location enrichment columns to environment_regions if not present
ALTER TABLE environment_regions
  ADD COLUMN IF NOT EXISTS country VARCHAR(100),
  ADD COLUMN IF NOT EXISTS admin1 VARCHAR(100),
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(60) DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP;

-- Pre-seed Open-Meteo provider metric sources
INSERT INTO environment_sources (name, provider, metric, unit)
VALUES
  ('Open-Meteo Weather', 'open-meteo', 'temperature', '°C'),
  ('Open-Meteo Weather', 'open-meteo', 'relative_humidity', '%'),
  ('Open-Meteo Weather', 'open-meteo', 'precipitation', 'mm'),
  ('Open-Meteo Weather', 'open-meteo', 'wind_speed', 'km/h'),
  ('Open-Meteo Weather', 'open-meteo', 'surface_pressure', 'hPa'),
  ('Open-Meteo Air Quality', 'open-meteo', 'pm2_5', 'µg/m³'),
  ('Open-Meteo Air Quality', 'open-meteo', 'pm10', 'µg/m³'),
  ('Open-Meteo Air Quality', 'open-meteo', 'us_aqi', 'AQI')
ON CONFLICT (provider, metric) DO UPDATE SET enabled = TRUE;

-- Additional performance indexes for time-series queries
CREATE INDEX IF NOT EXISTS idx_environment_observations_observed_at
  ON environment_observations (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_environment_ingestion_runs_started_at
  ON environment_ingestion_runs (started_at DESC);

COMMIT;
