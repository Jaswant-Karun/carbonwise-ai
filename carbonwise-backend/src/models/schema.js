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
    console.log('✅ Database tables initialized successfully');
  } catch (err) {
    console.error('❌ Error initializing database tables:', err.stack);
  }
};

module.exports = { initDb };
