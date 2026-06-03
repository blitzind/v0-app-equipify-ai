-- Repair: cron_execution_runs was created without service_role table grants.
-- PostgREST (supabase-js service role) requires explicit GRANTs; without them
-- isGrowthCronTelemetrySchemaReady() fails and cron runs succeed without telemetry rows.

grant usage on schema growth to service_role;

revoke all on table growth.cron_execution_runs from public, anon, authenticated;
grant select, insert, update, delete on table growth.cron_execution_runs to service_role;

alter table growth.cron_execution_runs enable row level security;
alter table growth.cron_execution_runs force row level security;

grant usage, select on all sequences in schema growth to service_role;
