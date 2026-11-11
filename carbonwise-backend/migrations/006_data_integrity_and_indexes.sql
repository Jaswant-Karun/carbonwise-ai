-- Migration 006: Data Integrity, Constraints & Performance Indexes
-- Version: 006
-- Applied to: PostgreSQL

-- 1. Performance Indexes on Core Activity Management
CREATE INDEX IF NOT EXISTS idx_activities_user_date ON activities (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_activities_user_type ON activities (user_id, activity_type);
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities (date);

-- 2. Constraints on Activity Emissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_activities_carbon_emissions_non_negative'
  ) THEN
    ALTER TABLE activities ADD CONSTRAINT chk_activities_carbon_emissions_non_negative CHECK (carbon_emissions >= 0);
  END IF;
END $$;

-- 3. Indexes on Connected Activity Emissions
CREATE INDEX IF NOT EXISTS idx_activity_emissions_user_calculated ON activity_emissions (user_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_emissions_scope ON activity_emissions (scope);

-- 4. Indexes on Climate Coach & Scenarios
CREATE INDEX IF NOT EXISTS idx_scenarios_user_created ON scenarios (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_plans_user_created ON coach_plans (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_actions_user_status ON coach_actions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_coach_actions_plan_id ON coach_actions (plan_id);
CREATE INDEX IF NOT EXISTS idx_coach_goals_user_status ON coach_goals (user_id, status);

-- 5. Indexes on Impact Verification & Baseline Tracking
CREATE INDEX IF NOT EXISTS idx_impact_baselines_user ON impact_baselines (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_impact_reports_user_month ON impact_reports (user_id, report_month DESC);
