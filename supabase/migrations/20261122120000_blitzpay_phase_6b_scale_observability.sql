-- BlitzPay Phase 6B — enterprise scale & financial observability foundations (deterministic metadata; no autonomous execution).
-- Org-scoped RLS for tenant data; platform-scoped queue rows have no member SELECT policies (service role only).

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regclass('public.profiles') is null then
    raise exception 'Missing dependency: public.profiles';
  end if;
  if to_regprocedure('public.has_org_role(uuid, text[])') is null then
    raise exception 'Missing dependency: public.has_org_role(uuid, text[])';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'Missing dependency: public.set_updated_at()';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Financial events (replay-safe metadata; lifecycle statuses)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_financial_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  event_type text not null
    check (event_type in (
      'payment', 'collections', 'payroll', 'financing', 'treasury', 'procurement', 'claims',
      'mobile_sync', 'accounting', 'custom'
    )),
  event_status text not null default 'queued'
    check (event_status in ('queued', 'processing', 'completed', 'failed', 'replayed', 'archived')),
  aggregate_type text,
  aggregate_id uuid,
  source_reference text,
  idempotency_key text,
  replayable boolean not null default true,
  event_version integer not null default 1 check (event_version >= 1 and event_version <= 9999),
  event_payload jsonb not null default '{}'::jsonb,
  event_hash text check (event_hash is null or char_length(event_hash) >= 32),
  queued_at timestamptz,
  processed_at timestamptz,
  replayed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_financial_events is
  'BlitzPay financial event sourcing metadata (bounded reads from APIs; server-side writes only; not a money-movement ledger).';

create index if not exists idx_blitzpay_financial_events_org_created
  on public.blitzpay_financial_events (organization_id, created_at desc);

create index if not exists idx_blitzpay_financial_events_org_status
  on public.blitzpay_financial_events (organization_id, event_status);

-- ---------------------------------------------------------------------------
-- Workflow executions (orchestration visibility; bounded attempts)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_workflow_executions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  workflow_type text not null
    check (workflow_type in (
      'collections_retry', 'payroll_processing', 'financing_sync', 'procurement_sync', 'claims_review',
      'treasury_snapshot', 'ai_generation', 'mobile_sync', 'custom'
    )),
  execution_status text not null default 'queued'
    check (execution_status in ('queued', 'processing', 'completed', 'failed', 'canceled', 'replayed')),
  related_entity_type text,
  related_entity_id uuid,
  idempotency_key text,
  execution_attempts integer not null default 0 check (execution_attempts >= 0 and execution_attempts <= 99),
  max_attempts integer not null default 3 check (max_attempts >= 1 and max_attempts <= 25),
  execution_summary text,
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_workflow_exec_org_status
  on public.blitzpay_workflow_executions (organization_id, execution_status);

-- ---------------------------------------------------------------------------
-- Queue health snapshots (metrics rows; org or platform scope)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_queue_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  snapshot_scope text not null check (snapshot_scope in ('org', 'platform')),
  queue_depth integer check (queue_depth is null or queue_depth >= 0),
  failed_execution_count integer check (failed_execution_count is null or failed_execution_count >= 0),
  replay_pending_count integer check (replay_pending_count is null or replay_pending_count >= 0),
  avg_processing_latency_ms integer check (avg_processing_latency_ms is null or avg_processing_latency_ms >= 0),
  idempotency_conflict_count integer check (idempotency_conflict_count is null or idempotency_conflict_count >= 0),
  worker_health_score integer check (worker_health_score is null or (worker_health_score >= 0 and worker_health_score <= 100)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    (snapshot_scope = 'org' and organization_id is not null)
    or (snapshot_scope = 'platform' and organization_id is null)
  )
);

create index if not exists idx_blitzpay_queue_health_org_created
  on public.blitzpay_queue_health_snapshots (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Idempotency records (duplicate suppression metadata)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_idempotency_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) >= 8 and char_length(idempotency_key) <= 512),
  request_hash text check (request_hash is null or char_length(request_hash) >= 32),
  request_scope text,
  request_status text not null default 'processing'
    check (request_status in ('processing', 'completed', 'rejected', 'expired')),
  response_reference text,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create index if not exists idx_blitzpay_idempotency_org_status
  on public.blitzpay_idempotency_records (organization_id, request_status);

-- ---------------------------------------------------------------------------
-- Observability audit (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_observability_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  workflow_execution_id uuid references public.blitzpay_workflow_executions (id) on delete set null,
  financial_event_id uuid references public.blitzpay_financial_events (id) on delete set null,
  audit_type text not null
    check (audit_type in (
      'event_created', 'event_replayed', 'workflow_started', 'workflow_failed', 'workflow_replayed',
      'idempotency_conflict', 'queue_backpressure', 'worker_override', 'manual_replay'
    )),
  actor_type text not null check (actor_type in ('system', 'admin', 'worker')),
  actor_id uuid references public.profiles (id) on delete set null,
  audit_summary text not null,
  immutable_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_obs_audit_org_created
  on public.blitzpay_observability_audit_log (organization_id, created_at desc);

create or replace function public.blitzpay_observability_audit_block_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'blitzpay_observability_audit_immutable';
end;
$$;

drop trigger if exists trg_blitzpay_obs_audit_block_update on public.blitzpay_observability_audit_log;
create trigger trg_blitzpay_obs_audit_block_update
before update on public.blitzpay_observability_audit_log
for each row execute function public.blitzpay_observability_audit_block_mutation();

drop trigger if exists trg_blitzpay_obs_audit_block_delete on public.blitzpay_observability_audit_log;
create trigger trg_blitzpay_obs_audit_block_delete
before delete on public.blitzpay_observability_audit_log
for each row execute function public.blitzpay_observability_audit_block_mutation();

-- ---------------------------------------------------------------------------
-- Multi-region readiness metadata (readiness only; no active replication control)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_multi_region_sync_state (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  region_name text not null check (char_length(region_name) >= 2 and char_length(region_name) <= 64),
  sync_status text not null default 'active'
    check (sync_status in ('active', 'degraded', 'replaying', 'offline', 'archived')),
  replication_lag_ms integer check (replication_lag_ms is null or replication_lag_ms >= 0),
  replay_queue_depth integer check (replay_queue_depth is null or replay_queue_depth >= 0),
  region_health_score integer check (region_health_score is null or (region_health_score >= 0 and region_health_score <= 100)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, region_name)
);

create index if not exists idx_blitzpay_multi_region_org
  on public.blitzpay_multi_region_sync_state (organization_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers (mutable tables)
-- ---------------------------------------------------------------------------
drop trigger if exists trg_blitzpay_financial_events_updated on public.blitzpay_financial_events;
create trigger trg_blitzpay_financial_events_updated
before update on public.blitzpay_financial_events
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_workflow_exec_updated on public.blitzpay_workflow_executions;
create trigger trg_blitzpay_workflow_exec_updated
before update on public.blitzpay_workflow_executions
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_idempotency_updated on public.blitzpay_idempotency_records;
create trigger trg_blitzpay_idempotency_updated
before update on public.blitzpay_idempotency_records
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_multi_region_updated on public.blitzpay_multi_region_sync_state;
create trigger trg_blitzpay_multi_region_updated
before update on public.blitzpay_multi_region_sync_state
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS (finance roles for org rows; platform rows have no member policies)
-- ---------------------------------------------------------------------------
revoke all on table public.blitzpay_financial_events from public, anon;
revoke all on table public.blitzpay_workflow_executions from public, anon;
revoke all on table public.blitzpay_queue_health_snapshots from public, anon;
revoke all on table public.blitzpay_idempotency_records from public, anon;
revoke all on table public.blitzpay_observability_audit_log from public, anon;
revoke all on table public.blitzpay_multi_region_sync_state from public, anon;

grant select on table public.blitzpay_financial_events to authenticated;
grant select on table public.blitzpay_workflow_executions to authenticated;
grant select on table public.blitzpay_queue_health_snapshots to authenticated;
grant select on table public.blitzpay_idempotency_records to authenticated;
grant select on table public.blitzpay_observability_audit_log to authenticated;
grant select on table public.blitzpay_multi_region_sync_state to authenticated;

alter table public.blitzpay_financial_events enable row level security;
alter table public.blitzpay_financial_events force row level security;
alter table public.blitzpay_workflow_executions enable row level security;
alter table public.blitzpay_workflow_executions force row level security;
alter table public.blitzpay_queue_health_snapshots enable row level security;
alter table public.blitzpay_queue_health_snapshots force row level security;
alter table public.blitzpay_idempotency_records enable row level security;
alter table public.blitzpay_idempotency_records force row level security;
alter table public.blitzpay_observability_audit_log enable row level security;
alter table public.blitzpay_observability_audit_log force row level security;
alter table public.blitzpay_multi_region_sync_state enable row level security;
alter table public.blitzpay_multi_region_sync_state force row level security;

drop policy if exists "blitzpay_financial_events_select_finance" on public.blitzpay_financial_events;
create policy "blitzpay_financial_events_select_finance"
on public.blitzpay_financial_events for select to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_workflow_exec_select_finance" on public.blitzpay_workflow_executions;
create policy "blitzpay_workflow_exec_select_finance"
on public.blitzpay_workflow_executions for select to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_queue_health_select_org" on public.blitzpay_queue_health_snapshots;
create policy "blitzpay_queue_health_select_org"
on public.blitzpay_queue_health_snapshots for select to authenticated
using (
  snapshot_scope = 'org'
  and organization_id is not null
  and public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[])
);

drop policy if exists "blitzpay_idempotency_select_finance" on public.blitzpay_idempotency_records;
create policy "blitzpay_idempotency_select_finance"
on public.blitzpay_idempotency_records for select to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_obs_audit_select_finance" on public.blitzpay_observability_audit_log;
create policy "blitzpay_obs_audit_select_finance"
on public.blitzpay_observability_audit_log for select to authenticated
using (
  organization_id is not null
  and public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[])
);

drop policy if exists "blitzpay_multi_region_select_finance" on public.blitzpay_multi_region_sync_state;
create policy "blitzpay_multi_region_select_finance"
on public.blitzpay_multi_region_sync_state for select to authenticated
using (
  organization_id is not null
  and public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[])
);
