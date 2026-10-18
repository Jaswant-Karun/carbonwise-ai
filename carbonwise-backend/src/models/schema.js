const db = require('../config/db');

// Creates necessary tables if they don't exist
const initDb = async () => {
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
//Added new Activity
  const createActivitiesTable = `
    CREATE TABLE IF NOT EXISTS activities (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      activity_type VARCHAR(50) NOT NULL, -- e.g., 'transport', 'electricity', 'food'
      details JSONB NOT NULL,
      carbon_emissions DECIMAL(10, 2) NOT NULL, -- in kg CO2
      date DATE DEFAULT CURRENT_DATE
    );
  `;

  const createScenariosTable = `
    CREATE TABLE IF NOT EXISTS scenarios (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(120) NOT NULL,
      period_days INTEGER NOT NULL CHECK (period_days BETWEEN 1 AND 365),
      changes JSONB NOT NULL,
      baseline_emissions DECIMAL(10, 2) NOT NULL CHECK (baseline_emissions >= 0),
      scenario_emissions DECIMAL(10, 2) NOT NULL CHECK (scenario_emissions >= 0),
      potential_savings_kg DECIMAL(10, 2) NOT NULL CHECK (potential_savings_kg >= 0),
      potential_savings_percentage DECIMAL(6, 2) NOT NULL CHECK (potential_savings_percentage >= 0),
      assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createCoachPlansTable = `
    CREATE TABLE IF NOT EXISTS coach_plans (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      period_days INTEGER NOT NULL DEFAULT 7 CHECK (period_days BETWEEN 1 AND 31),
      narrative TEXT,
      narrative_source VARCHAR(20) NOT NULL DEFAULT 'deterministic' CHECK (narrative_source IN ('deterministic', 'gemini')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createCoachActionsTable = `
    CREATE TABLE IF NOT EXISTS coach_actions (
      id SERIAL PRIMARY KEY,
      plan_id INTEGER NOT NULL REFERENCES coach_plans(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day_number INTEGER NOT NULL CHECK (day_number BETWEEN 1 AND 7),
      category VARCHAR(50) NOT NULL,
      title VARCHAR(160) NOT NULL,
      explanation VARCHAR(500) NOT NULL,
      suggested_target VARCHAR(240) NOT NULL,
      estimated_potential_savings_kg DECIMAL(10, 2),
      status VARCHAR(20) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'skipped')),
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createCoachGoalsTable = `
    CREATE TABLE IF NOT EXISTS coach_goals (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      period VARCHAR(10) NOT NULL CHECK (period IN ('weekly', 'monthly')),
      category VARCHAR(50),
      target_kg DECIMAL(10, 2) NOT NULL CHECK (target_kg > 0),
      baseline_kg DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (baseline_kg >= 0),
      status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createImpactBaselinesTable = `
    CREATE TABLE IF NOT EXISTS impact_baselines (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(120) NOT NULL,
      period_days INTEGER NOT NULL CHECK (period_days IN (7, 30, 90, 365)),
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      total_emissions DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (total_emissions >= 0),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createImpactReportsTable = `
    CREATE TABLE IF NOT EXISTS impact_reports (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      baseline_id INTEGER REFERENCES impact_baselines(id) ON DELETE SET NULL,
      period_days INTEGER NOT NULL CHECK (period_days IN (7, 30, 90, 365)),
      report_month DATE NOT NULL,
      report_data JSONB NOT NULL,
      narrative TEXT,
      narrative_source VARCHAR(20) NOT NULL DEFAULT 'deterministic' CHECK (narrative_source IN ('deterministic', 'gemini')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createAiResponseCacheTable = `
    CREATE TABLE IF NOT EXISTS ai_response_cache (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task VARCHAR(80) NOT NULL,
      cache_key CHAR(64) NOT NULL,
      response TEXT NOT NULL,
      data_version VARCHAR(120) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, task, cache_key)
    );
  `;

  const createEnvironmentSourcesTable = `
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
  `;

  const createEnvironmentRegionsTable = `
    CREATE TABLE IF NOT EXISTS environment_regions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(120) NOT NULL,
      latitude DECIMAL(8, 5) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
      longitude DECIMAL(8, 5) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createEnvironmentObservationsTable = `
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
  `;

  const createEnvironmentIngestionRunsTable = `
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
  `;

  const createEnvironmentAlertsTable = `
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
  `;

  try {
    await db.query(createUsersTable);
    await db.query(createActivitiesTable);
    await db.query(createScenariosTable);
    await db.query(createCoachPlansTable);
    await db.query(createCoachActionsTable);
    await db.query(createCoachGoalsTable);
    await db.query(createImpactBaselinesTable);
    await db.query(createImpactReportsTable);
    await db.query(createAiResponseCacheTable);
    await db.query(createEnvironmentSourcesTable);
    await db.query(createEnvironmentRegionsTable);
    await db.query(createEnvironmentObservationsTable);
    await db.query(createEnvironmentIngestionRunsTable);
    await db.query(createEnvironmentAlertsTable);
    await db.query(`
      ALTER TABLE environment_regions
        ADD COLUMN IF NOT EXISTS country VARCHAR(100),
        ADD COLUMN IF NOT EXISTS admin1 VARCHAR(100),
        ADD COLUMN IF NOT EXISTS timezone VARCHAR(60) DEFAULT 'UTC',
        ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP
    `);
    await db.query(`
      ALTER TABLE environment_alerts
        ADD COLUMN IF NOT EXISTS anomaly_category VARCHAR(40) DEFAULT 'atmospheric',
        ADD COLUMN IF NOT EXISTS anomaly_type VARCHAR(60),
        ADD COLUMN IF NOT EXISTS deviation DECIMAL(14, 4),
        ADD COLUMN IF NOT EXISTS detection_method VARCHAR(80),
        ADD COLUMN IF NOT EXISTS data_source VARCHAR(100) DEFAULT 'open-meteo',
        ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(5, 2) DEFAULT 1.0,
        ADD COLUMN IF NOT EXISTS duration_hours INTEGER DEFAULT 1,
        ADD COLUMN IF NOT EXISTS is_persistent BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS evidence JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS resolution_history JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS source_url VARCHAR(300)
    `);
    await db.query(`
      INSERT INTO environment_sources (name, provider, metric, unit)
      VALUES
        ('Open-Meteo Weather', 'open-meteo', 'temperature', '°C'),
        ('Open-Meteo Weather', 'open-meteo', 'relative_humidity', '%'),
        ('Open-Meteo Weather', 'open-meteo', 'precipitation', 'mm'),
        ('Open-Meteo Weather', 'open-meteo', 'wind_speed', 'km/h'),
        ('Open-Meteo Weather', 'open-meteo', 'surface_pressure', 'hPa'),
        ('Open-Meteo Air Quality', 'open-meteo', 'pm2_5', 'µg/m³'),
        ('Open-Meteo Air Quality', 'open-meteo', 'pm10', 'µg/m³'),
        ('Open-Meteo Air Quality', 'open-meteo', 'us_aqi', 'AQI'),
        ('OpenAQ Air Quality', 'openaq', 'pm2_5', 'µg/m³'),
        ('OpenAQ Air Quality', 'openaq', 'pm10', 'µg/m³'),
        ('OpenAQ Air Quality', 'openaq', 'no2', 'µg/m³'),
        ('OpenAQ Air Quality', 'openaq', 'o3', 'µg/m³'),
        ('OpenAQ Air Quality', 'openaq', 'so2', 'µg/m³'),
        ('OpenAQ Air Quality', 'openaq', 'co', 'mg/m³')
      ON CONFLICT (provider, metric) DO UPDATE SET enabled = TRUE
    `);
    await db.query('CREATE INDEX IF NOT EXISTS environment_observations_region_metric_time_idx ON environment_observations (region_id, metric, observed_at DESC)');
    await db.query('CREATE INDEX IF NOT EXISTS environment_alerts_user_status_created_idx ON environment_alerts (user_id, status, created_at DESC)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_environment_alerts_dedup ON environment_alerts (user_id, region_id, metric, anomaly_category, status)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_environment_alerts_category_severity_status ON environment_alerts (user_id, anomaly_category, severity, status, created_at DESC)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_environment_observations_observed_at ON environment_observations (observed_at DESC)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_environment_ingestion_runs_started_at ON environment_ingestion_runs (started_at DESC)');
    console.log('✅ Database tables initialized successfully');
  } catch (err) {
    console.error('❌ Error initializing database tables:', err.stack);
  }
};

module.exports = { initDb };
