-- GE-AI-3B — Revenue Director Decision Ledger (persistent advisory decisions).
-- Organization-scoped, audited, service-role only — NOT Core mutations.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.revenue_director_decisions
-- -----------------------------------------------------------------------------

create table if not exists growth.revenue_director_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  snapshot_hash text not null,
  decision_type text not null default 'executive_orchestration_snapshot'
    check (decision_type in ('executive_orchestration_snapshot', 'workflow_request_batch')),

  status text not null default 'proposed'
    check (status in ('proposed', 'accepted', 'superseded', 'cancelled', 'completed')),

  title text not null,
  summary text not null default '',
  confidence numeric(5, 2) not null default 0,
  priority_score integer not null default 0,

  evidence jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,

  audit_metadata jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-ge-ai-3b-revenue-director-decision-ledger-v1',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  superseded_at timestamptz
);

create index if not exists revenue_director_decisions_org_status_idx
  on growth.revenue_director_decisions (organization_id, status, updated_at desc);

create index if not exists revenue_director_decisions_org_snapshot_idx
  on growth.revenue_director_decisions (organization_id, snapshot_hash);

create unique index if not exists revenue_director_decisions_org_snapshot_uidx
  on growth.revenue_director_decisions (organization_id, snapshot_hash)
  where status in ('proposed', 'accepted');

comment on table growth.revenue_director_decisions is
  'GE-AI-3B Revenue Director executive decision ledger — advisory only, no dispatch.';

-- -----------------------------------------------------------------------------
-- growth.revenue_director_workflow_requests
-- -----------------------------------------------------------------------------

create table if not exists growth.revenue_director_workflow_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  decision_id uuid not null references growth.revenue_director_decisions (id) on delete cascade,

  request_type text not null,
  target_workflow_agent text not null default 'none',
  status text not null default 'proposed'
    check (status in (
      'proposed', 'accepted', 'dispatched', 'completed', 'failed',
      'cancelled', 'superseded', 'expired'
    )),

  advisory boolean not null default true,

  subject_type text,
  subject_id text,
  objective_id text,
  mission_id text,
  lead_id text,

  title text not null,
  summary text not null default '',
  priority_score integer not null default 0,
  requires_human_approval boolean not null default true,

  idempotency_key text not null,
  correlation_id uuid not null default gen_random_uuid(),

  evidence jsonb not null default '[]'::jsonb,
  route text,

  audit_metadata jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-ge-ai-3b-revenue-director-decision-ledger-v1',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  dispatched_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  superseded_at timestamptz
);

create index if not exists revenue_director_workflow_requests_decision_idx
  on growth.revenue_director_workflow_requests (decision_id, created_at desc);

create index if not exists revenue_director_workflow_requests_org_status_idx
  on growth.revenue_director_workflow_requests (organization_id, status, priority_score desc);

create unique index if not exists revenue_director_workflow_requests_idempotency_uidx
  on growth.revenue_director_workflow_requests (organization_id, idempotency_key);

comment on table growth.revenue_director_workflow_requests is
  'GE-AI-3B durable advisory workflow requests — idempotent per organization.';

-- -----------------------------------------------------------------------------
-- growth.revenue_director_decision_events
-- -----------------------------------------------------------------------------

create table if not exists growth.revenue_director_decision_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  decision_id uuid references growth.revenue_director_decisions (id) on delete cascade,
  workflow_request_id uuid references growth.revenue_director_workflow_requests (id) on delete set null,

  event_type text not null
    check (event_type in (
      'proposed', 'accepted', 'dispatched', 'completed', 'failed',
      'cancelled', 'superseded', 'expired'
    )),

  payload jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-ge-ai-3b-revenue-director-decision-ledger-v1',
  created_at timestamptz not null default now()
);

create index if not exists revenue_director_decision_events_org_type_idx
  on growth.revenue_director_decision_events (organization_id, event_type, created_at desc);

create index if not exists revenue_director_decision_events_decision_idx
  on growth.revenue_director_decision_events (decision_id, created_at desc);

comment on table growth.revenue_director_decision_events is
  'GE-AI-3B append-only Revenue Director lifecycle audit.';

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------

drop trigger if exists trg_growth_revenue_director_decisions_updated_at on growth.revenue_director_decisions;
create trigger trg_growth_revenue_director_decisions_updated_at
  before update on growth.revenue_director_decisions
  for each row execute function public.set_updated_at();

drop trigger if exists trg_growth_revenue_director_workflow_requests_updated_at on growth.revenue_director_workflow_requests;
create trigger trg_growth_revenue_director_workflow_requests_updated_at
  before update on growth.revenue_director_workflow_requests
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — service_role only
-- -----------------------------------------------------------------------------

revoke all on table growth.revenue_director_decisions from public, anon, authenticated;
revoke all on table growth.revenue_director_workflow_requests from public, anon, authenticated;
revoke all on table growth.revenue_director_decision_events from public, anon, authenticated;

grant select, insert, update, delete on table growth.revenue_director_decisions to service_role;
grant select, insert, update, delete on table growth.revenue_director_workflow_requests to service_role;
grant select, insert on table growth.revenue_director_decision_events to service_role;

alter table growth.revenue_director_decisions enable row level security;
alter table growth.revenue_director_decisions force row level security;

alter table growth.revenue_director_workflow_requests enable row level security;
alter table growth.revenue_director_workflow_requests force row level security;

alter table growth.revenue_director_decision_events enable row level security;
alter table growth.revenue_director_decision_events force row level security;

drop policy if exists growth_revenue_director_decisions_service_role on growth.revenue_director_decisions;
create policy growth_revenue_director_decisions_service_role
  on growth.revenue_director_decisions for all to service_role using (true) with check (true);

drop policy if exists growth_revenue_director_workflow_requests_service_role on growth.revenue_director_workflow_requests;
create policy growth_revenue_director_workflow_requests_service_role
  on growth.revenue_director_workflow_requests for all to service_role using (true) with check (true);

drop policy if exists growth_revenue_director_decision_events_service_role on growth.revenue_director_decision_events;
create policy growth_revenue_director_decision_events_service_role
  on growth.revenue_director_decision_events for all to service_role using (true) with check (true);
