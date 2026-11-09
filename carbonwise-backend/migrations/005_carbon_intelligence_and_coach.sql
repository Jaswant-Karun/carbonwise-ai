-- Migration 005: Carbon Intelligence, What-If Scenarios, Eco-Coach & Impact Tracking
-- Version: 005
-- Applied to: PostgreSQL

-- 1. Scenarios Table (What-If Carbon Simulator)
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

CREATE INDEX IF NOT EXISTS idx_scenarios_user_id ON scenarios(user_id);

-- 2. Coach Plans Table (Adaptive AI Eco-Coach)
CREATE TABLE IF NOT EXISTS coach_plans (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_days INTEGER NOT NULL DEFAULT 7 CHECK (period_days BETWEEN 1 AND 31),
  narrative TEXT,
  narrative_source VARCHAR(20) NOT NULL DEFAULT 'deterministic' CHECK (narrative_source IN ('deterministic', 'gemini')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coach_plans_user_id ON coach_plans(user_id);

-- 3. Coach Actions Table (Adaptive Action Tracking)
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

CREATE INDEX IF NOT EXISTS idx_coach_actions_user_status ON coach_actions(user_id, status);

-- 4. Coach Goals Table (User Sustainability Targets)
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

CREATE INDEX IF NOT EXISTS idx_coach_goals_user_id ON coach_goals(user_id);

-- 5. Impact Baselines Table (Sustainability Impact Tracker)
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

CREATE INDEX IF NOT EXISTS idx_impact_baselines_user_id ON impact_baselines(user_id);

-- 6. Impact Reports Table (Audited Real Reductions vs Modeled Savings)
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

CREATE INDEX IF NOT EXISTS idx_impact_reports_user_id ON impact_reports(user_id);
