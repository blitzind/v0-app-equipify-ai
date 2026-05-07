-- Async imports Phase 2: lease locking, retries/backoff, recovery metadata.

alter table public.organization_import_job_runs
  add column if not exists lease_owner text,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists retry_count integer not null default 0,
  add column if not exists max_retries integer not null default 5,
  add column if not exists next_retry_at timestamptz,
  add column if not exists last_error_at timestamptz,
  add column if not exists recovery_json jsonb not null default '{}'::jsonb;

comment on column public.organization_import_job_runs.lease_owner is
  'Worker identity currently holding processing lease.';
comment on column public.organization_import_job_runs.lease_expires_at is
  'Lease expiry to prevent dual chunk processing by concurrent workers.';
comment on column public.organization_import_job_runs.retry_count is
  'Transient failure retries attempted for this run.';
comment on column public.organization_import_job_runs.max_retries is
  'Retry ceiling before run is marked failed.';
comment on column public.organization_import_job_runs.next_retry_at is
  'Earliest timestamp at which worker should attempt next retry.';
comment on column public.organization_import_job_runs.last_error_at is
  'Timestamp of latest processing failure.';
comment on column public.organization_import_job_runs.recovery_json is
  'Recovery diagnostics for failed/cancelled runs (cursor, chunk, reason).';

create index if not exists idx_org_import_job_runs_retry_window
  on public.organization_import_job_runs (status, next_retry_at, updated_at desc);

create index if not exists idx_org_import_job_runs_lease_expires
  on public.organization_import_job_runs (lease_expires_at, updated_at desc);
