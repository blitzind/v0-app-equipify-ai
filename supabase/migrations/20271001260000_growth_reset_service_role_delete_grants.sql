-- GE-AVA-FRESH-SLATE-1G — service_role DELETE for operational reset permission-denied tables.
--
-- PostgREST uses the service_role JWT. Without explicit GRANT DELETE, scoped reset deletes
-- fail with "permission denied" even when RLS would allow the row.
--
-- Scope: DELETE only on the 11 growth tables listed below — no schema-wide grants, no RLS changes.
-- Idempotent: GRANT is safe to re-run; skipped when the relation is absent.
--
-- Note: version 20271001260000 — Supabase schema_migrations PK is timestamp-only; 20270629123000
-- is already registered for a prior migration in this repo.

do $$
declare
  t text;
begin
  foreach t in array array[
    'growth.ai_os_event_deliveries',
    'growth.closed_loop_learning_events',
    'growth.ai_os_events',
    'growth.ai_executive_brain_runtime',
    'growth.sequence_enrollment_channel_events',
    'growth.growth_sendr_launch_runs',
    'growth.opportunity_stage_history',
    'growth.meetings',
    'growth.cadence_tasks',
    'growth.lead_timeline_events',
    'growth.platform_timeline_events'
  ]
  loop
    if to_regclass(t) is not null then
      execute format('grant delete on table %s to service_role', t);
    end if;
  end loop;
end $$;
