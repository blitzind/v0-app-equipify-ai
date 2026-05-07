-- Phase 3 (Async imports Phase 1): additive background run tracking and progress foundations.

alter table public.organization_import_jobs
  add column if not exists active_run_id uuid,
  add column if not exists processed_count integer not null default 0,
  add column if not exists cancel_requested_at timestamptz;

comment on column public.organization_import_jobs.active_run_id is
  'Current async run id for this job (nullable; set during background processing).';
comment on column public.organization_import_jobs.processed_count is
  'Rows processed so far (progress only; final outcomes remain in *_count fields).';
comment on column public.organization_import_jobs.cancel_requested_at is
  'Timestamp when a cancellation was requested by owner/admin.';

create table if not exists public.organization_import_job_runs (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null references public.organization_import_jobs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  run_mode text not null default 'async'
    check (run_mode in ('async', 'sync')),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'completed_with_errors', 'failed', 'cancelled')),
  chunk_size integer not null default 500 check (chunk_size >= 50 and chunk_size <= 2000),
  total_rows integer not null default 0,
  total_chunks integer not null default 0,
  current_chunk_index integer not null default 0,
  resume_cursor integer not null default 0,
  processed_count integer not null default 0,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  error_count integer not null default 0,
  cancel_requested_at timestamptz,
  started_at timestamptz,
  last_heartbeat_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid references auth.users (id) on delete set null,
  committed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organization_import_job_runs is
  'Execution runs for import jobs (chunk progress, resumability, cancellation foundation).';

create index if not exists idx_org_import_job_runs_job_created
  on public.organization_import_job_runs (import_job_id, created_at desc);
create index if not exists idx_org_import_job_runs_org_created
  on public.organization_import_job_runs (organization_id, created_at desc);
create index if not exists idx_org_import_job_runs_status
  on public.organization_import_job_runs (status, updated_at desc);

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_organization_import_job_runs_set_updated_at on public.organization_import_job_runs;
    create trigger trg_organization_import_job_runs_set_updated_at
    before update on public.organization_import_job_runs
    for each row execute function public.set_updated_at();
  end if;
end
$$;

alter table public.organization_import_jobs
  drop constraint if exists organization_import_jobs_active_run_id_fkey;
alter table public.organization_import_jobs
  add constraint organization_import_jobs_active_run_id_fkey
  foreign key (active_run_id) references public.organization_import_job_runs (id) on delete set null;

revoke all on table public.organization_import_job_runs from public, anon;
grant select, insert, update, delete on table public.organization_import_job_runs to authenticated;

alter table public.organization_import_job_runs enable row level security;
alter table public.organization_import_job_runs force row level security;

drop policy if exists "organization_import_job_runs_select_admin" on public.organization_import_job_runs;
create policy "organization_import_job_runs_select_admin"
on public.organization_import_job_runs for select to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin']));

drop policy if exists "organization_import_job_runs_write_admin" on public.organization_import_job_runs;
create policy "organization_import_job_runs_write_admin"
on public.organization_import_job_runs for all to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin']))
with check (public.has_org_role (organization_id, array['owner', 'admin']));
