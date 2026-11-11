-- Migration 006 Down: Revert Data Integrity, Constraints & Performance Indexes
-- Version: 006
-- Applied to: PostgreSQL

DROP INDEX IF EXISTS idx_activities_user_date;
DROP INDEX IF EXISTS idx_activities_user_type;
DROP INDEX IF EXISTS idx_activities_date;
ALTER TABLE activities DROP CONSTRAINT IF EXISTS chk_activities_carbon_emissions_non_negative;
DROP INDEX IF EXISTS idx_activity_emissions_user_calculated;
DROP INDEX IF EXISTS idx_activity_emissions_scope;
DROP INDEX IF EXISTS idx_scenarios_user_created;
DROP INDEX IF EXISTS idx_coach_plans_user_created;
DROP INDEX IF EXISTS idx_coach_actions_user_status;
DROP INDEX IF EXISTS idx_coach_actions_plan_id;
DROP INDEX IF EXISTS idx_coach_goals_user_status;
DROP INDEX IF EXISTS idx_impact_baselines_user;
DROP INDEX IF EXISTS idx_impact_reports_user_month;

