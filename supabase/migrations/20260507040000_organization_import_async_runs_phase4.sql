-- Async imports Phase 4: operator events log + indexes for ops dashboards.
--
-- Additive only:
-- * New table `organization_import_run_operator_events` for human + system
--   notes/actions on import runs/jobs (bulk retry, bulk recover, manual notes).
-- * Operational indexes on `organization_import_job_runs` to support the
--   platform import-ops queue/health dashboard (status + updated_at, status +
--   next_retry_at + retry_count, completed_at).
--
-- Safety:
-- * No changes to existing async runner schema, cron flow, sync path, or
--   projection/duplicate handling.
-- * Org RLS preserved; service role bypass used only by trusted platform-admin
--   route handlers (consistent with prior phases).

create table if not exists public.organization_import_run_operator_events (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null references public.organization_import_jobs (id) on delete cascade,
  import_run_id uuid references public.organization_import_job_runs (id) on delete set null,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_email text,
  actor_kind text not null default 'operator'
    check (actor_kind in ('operator', 'platform_admin', 'system_cron', 'system')),
  event_type text not null
    check (event_type in (
      'note',
      'bulk_retry',
      'bulk_recover_stale',
      'manual_resume',
      'manual_cancel',
      'manual_lease_recover',
      'system_observation'
    )),
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'critical')),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.organization_import_run_operator_events is
  'Operator + system action/notes log for async import runs. Surfaces in Migration Center and Platform Admin Import Operations.';
comment on column public.organization_import_run_operator_events.actor_kind is
  'Distinguishes org operators, platform admins, cron observations, and unattributed system events.';
comment on column public.organization_import_run_operator_events.metadata is
  'Structured payload: run refs, batch sizes, recovery cursors, etc. Never embed secrets.';

create index if not exists idx_org_import_run_operator_events_job_created
  on public.organization_import_run_operator_events (import_job_id, created_at desc);
create index if not exists idx_org_import_run_operator_events_run_created
  on public.organization_import_run_operator_events (import_run_id, created_at desc);
create index if not exists idx_org_import_run_operator_events_org_created
  on public.organization_import_run_operator_events (organization_id, created_at desc);
create index if not exists idx_org_import_run_operator_events_event_type
  on public.organization_import_run_operator_events (event_type, created_at desc);

revoke all on table public.organization_import_run_operator_events from public, anon;
grant select, insert on table public.organization_import_run_operator_events to authenticated;

alter table public.organization_import_run_operator_events enable row level security;
alter table public.organization_import_run_operator_events force row level security;

drop policy if exists "import_run_operator_events_select_admin" on public.organization_import_run_operator_events;
create policy "import_run_operator_events_select_admin"
on public.organization_import_run_operator_events for select to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin']));

drop policy if exists "import_run_operator_events_insert_admin" on public.organization_import_run_operator_events;
create policy "import_run_operator_events_insert_admin"
on public.organization_import_run_operator_events for insert to authenticated
with check (public.has_org_role (organization_id, array['owner', 'admin']));

-- Operational indexes on the existing run table to keep the platform import-ops
-- dashboard fast without touching runner logic.
create index if not exists idx_org_import_job_runs_status_updated
  on public.organization_import_job_runs (status, updated_at desc);
create index if not exists idx_org_import_job_runs_status_completed_at
  on public.organization_import_job_runs (status, completed_at desc);
create index if not exists idx_org_import_job_runs_status_retry_count_next
  on public.organization_import_job_runs (status, retry_count, next_retry_at);
