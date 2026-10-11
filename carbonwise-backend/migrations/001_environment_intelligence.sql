BEGIN;

CREATE TABLE IF NOT EXISTS environment_sources (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  provider VARCHAR(80) NOT NULL,
  metric VARCHAR(80) NOT NULL,
  unit VARCHAR(40) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (provider, metric)
);

CREATE TABLE IF NOT EXISTS environment_regions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  latitude DECIMAL(8, 5) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DECIMAL(8, 5) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS environment_observations (
  id BIGSERIAL PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES environment_sources(id) ON DELETE RESTRICT,
  region_id INTEGER NOT NULL REFERENCES environment_regions(id) ON DELETE CASCADE,
  metric VARCHAR(80) NOT NULL,
  value DECIMAL(14, 4) NOT NULL,
  unit VARCHAR(40) NOT NULL,
  observed_at TIMESTAMP NOT NULL,
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  quality VARCHAR(30) NOT NULL DEFAULT 'observed',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (source_id, region_id, metric, observed_at)
);

CREATE TABLE IF NOT EXISTS environment_ingestion_runs (
  id BIGSERIAL PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES environment_sources(id) ON DELETE RESTRICT,
  region_id INTEGER REFERENCES environment_regions(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  observations_count INTEGER NOT NULL DEFAULT 0 CHECK (observations_count >= 0),
  error_code VARCHAR(80),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS environment_alerts (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  region_id INTEGER NOT NULL REFERENCES environment_regions(id) ON DELETE CASCADE,
  metric VARCHAR(80) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  observed_value DECIMAL(14, 4) NOT NULL,
  baseline_value DECIMAL(14, 4),
  threshold_value DECIMAL(14, 4),
  explanation VARCHAR(500) NOT NULL,
  observed_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS environment_observations_region_metric_time_idx
  ON environment_observations (region_id, metric, observed_at DESC);
CREATE INDEX IF NOT EXISTS environment_alerts_user_status_created_idx
  ON environment_alerts (user_id, status, created_at DESC);

COMMIT;
