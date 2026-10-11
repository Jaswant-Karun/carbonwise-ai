-- Rollback for 001_environment_intelligence.sql only.
-- Review and execute manually; this removes only the additive environmental objects.
BEGIN;
DROP TABLE IF EXISTS environment_alerts;
DROP TABLE IF EXISTS environment_ingestion_runs;
DROP TABLE IF EXISTS environment_observations;
DROP TABLE IF EXISTS environment_regions;
DROP TABLE IF EXISTS environment_sources;
COMMIT;
