-- Workflow Automations Phase 2 — visual builder + run testing.
--
-- Additive, idempotent migration that:
--   1. Widens the `workflow_automations.trigger_type` check constraint
--      to allow `prospect_status_changed` (Leads Phase 2 added the
--      dispatch path, Phase 1 of Workflow Automations made it
--      authorable in the builder UI; this finally aligns the DB
--      check with the API allowlist).
--   2. Widens the `workflow_runs.status` check constraint to allow
--      `simulated` so the new "Run test" simulator can persist a
--      first-class run row that managers see in the run history
--      drawer. Existing engine code never writes `simulated`, so
--      live runs are unaffected.
--
-- No data is rewritten. No tables are dropped. Re-running is safe.

alter table public.workflow_automations
  drop constraint if exists workflow_automations_trigger_type_check;

alter table public.workflow_automations
  add constraint workflow_automations_trigger_type_check check (
    trigger_type in (
      'work_order_created',
      'work_order_completed',
      'work_order_status_changed',
      'maintenance_due',
      'invoice_overdue',
      'quote_accepted',
      'equipment_warranty_expiring',
      'certificate_uploaded',
      'ai_assistant_digest_ready',
      'prospect_status_changed'
    )
  );

alter table public.workflow_runs
  drop constraint if exists workflow_runs_status_check;

alter table public.workflow_runs
  add constraint workflow_runs_status_check check (
    status in ('queued', 'running', 'completed', 'failed', 'simulated')
  );

comment on constraint workflow_runs_status_check on public.workflow_runs is
  'Phase 2: adds `simulated` for in-builder Run test executions that never trigger side-effects.';
