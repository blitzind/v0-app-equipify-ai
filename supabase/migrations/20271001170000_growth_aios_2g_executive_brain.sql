-- GE-AIOS-2G — Executive Brain foundation (Equipify AI OS).
-- Constitutional reference: AI Revenue Operator Constitution v1.0 §9, §12.
-- Orchestration runtime only — delegates Work Orders; does NOT claim, reason, or call providers.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regclass('growth.organization_growth_objectives') is null then
    raise exception 'Missing dependency: growth.organization_growth_objectives';
  end if;
  if to_regclass('growth.ai_work_orders') is null then
    raise exception 'Missing dependency: growth.ai_work_orders — apply GE-AIOS-2A migration first';
  end if;
  if to_regclass('growth.ai_os_events') is null then
    raise exception 'Missing dependency: growth.ai_os_events — apply GE-AIOS-2B migration first';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.ai_executive_brain_runtime — per-org executive orchestration session
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_executive_brain_runtime (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  instance_id text not null,

  runtime_status text not null default 'idle'
    check (runtime_status in (
      'sleeping',
      'idle',
      'planning',
      'delegating',
      'monitoring',
      'escalated',
      'completed'
    )),

  health_status text not null default 'healthy'
    check (health_status in ('healthy', 'degraded', 'unhealthy', 'offline')),

  active_mission_count int not null default 0 check (active_mission_count >= 0),
  active_delegation_count int not null default 0 check (active_delegation_count >= 0),

  last_heartbeat_at timestamptz not null default now(),
  last_tick_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-aios-2g-executive-brain-v1',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, instance_id)
);

create index if not exists ai_executive_brain_runtime_org_idx
  on growth.ai_executive_brain_runtime (organization_id, runtime_status);

comment on table growth.ai_executive_brain_runtime is
  'GE-AIOS-2G Executive Brain runtime — observes and delegates; never claims Work Orders.';

-- -----------------------------------------------------------------------------
-- growth.ai_executive_mission_state — per-mission orchestration tracking
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_executive_mission_state (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  mission_id uuid not null references growth.organization_growth_objectives (id) on delete cascade,
  executive_runtime_id uuid not null references growth.ai_executive_brain_runtime (id) on delete cascade,

  mission_status text not null default 'idle'
    check (mission_status in ('idle', 'active', 'monitoring', 'escalated', 'completed', 'paused')),

  pending_work_order_count int not null default 0 check (pending_work_order_count >= 0),
  active_work_order_count int not null default 0 check (active_work_order_count >= 0),
  completed_work_order_count int not null default 0 check (completed_work_order_count >= 0),

  last_delegated_at timestamptz,
  last_monitored_at timestamptz,
  last_tick_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-aios-2g-executive-brain-v1',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, mission_id, executive_runtime_id)
);

create index if not exists ai_executive_mission_state_mission_idx
  on growth.ai_executive_mission_state (organization_id, mission_id, mission_status);

comment on table growth.ai_executive_mission_state is
  'GE-AIOS-2G mission runtime state tracked by Executive Brain — no mission execution logic.';

-- -----------------------------------------------------------------------------
-- growth.ai_executive_delegations — Work Order delegation audit trail
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_executive_delegations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  mission_id uuid not null references growth.organization_growth_objectives (id) on delete cascade,
  executive_runtime_id uuid not null references growth.ai_executive_brain_runtime (id) on delete cascade,
  work_order_id uuid not null references growth.ai_work_orders (id) on delete cascade,

  assigned_agent text not null,
  delegation_status text not null default 'issued'
    check (delegation_status in ('issued', 'monitoring', 'completed', 'escalated', 'cancelled')),

  delegated_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-aios-2g-executive-brain-v1',
  created_at timestamptz not null default now(),

  constraint ai_executive_delegations_assigned_agent_check check (
    assigned_agent in (
      'prospecting',
      'research',
      'qualification',
      'strategy',
      'personalization',
      'outreach',
      'conversation',
      'meeting',
      'opportunity',
      'learning',
      'executive_reporting',
      'compliance',
      'budget',
      'provider',
      'warmup',
      'deliverability'
    )
  ),

  unique (work_order_id)
);

create index if not exists ai_executive_delegations_mission_idx
  on growth.ai_executive_delegations (organization_id, mission_id, delegation_status);

comment on table growth.ai_executive_delegations is
  'GE-AIOS-2G Executive Brain Work Order delegations — issued only, agents claim via runtime.';

-- -----------------------------------------------------------------------------
-- growth.ai_executive_heartbeat_events — append-only heartbeat audit
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_executive_heartbeat_events (
  id uuid primary key default gen_random_uuid(),
  executive_runtime_id uuid not null references growth.ai_executive_brain_runtime (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  runtime_status text not null,
  health_status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_executive_heartbeat_events_runtime_idx
  on growth.ai_executive_heartbeat_events (executive_runtime_id, created_at desc);

-- -----------------------------------------------------------------------------
-- growth.ai_executive_event_observations — subscribed event observations
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_executive_event_observations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  executive_runtime_id uuid not null references growth.ai_executive_brain_runtime (id) on delete cascade,
  event_id uuid references growth.ai_os_events (id) on delete set null,

  event_category text not null,
  event_type text not null,
  mission_id uuid,
  work_order_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists ai_executive_event_observations_runtime_idx
  on growth.ai_executive_event_observations (executive_runtime_id, observed_at desc);

comment on table growth.ai_executive_event_observations is
  'GE-AIOS-2G append-only Executive Brain event observations — no side effects.';

drop trigger if exists trg_growth_ai_executive_brain_runtime_updated_at
  on growth.ai_executive_brain_runtime;
create trigger trg_growth_ai_executive_brain_runtime_updated_at
  before update on growth.ai_executive_brain_runtime
  for each row execute function public.set_updated_at();

drop trigger if exists trg_growth_ai_executive_mission_state_updated_at
  on growth.ai_executive_mission_state;
create trigger trg_growth_ai_executive_mission_state_updated_at
  before update on growth.ai_executive_mission_state
  for each row execute function public.set_updated_at();

revoke all on table growth.ai_executive_brain_runtime from public, anon, authenticated;
revoke all on table growth.ai_executive_mission_state from public, anon, authenticated;
revoke all on table growth.ai_executive_delegations from public, anon, authenticated;
revoke all on table growth.ai_executive_heartbeat_events from public, anon, authenticated;
revoke all on table growth.ai_executive_event_observations from public, anon, authenticated;

grant select, insert, update on table growth.ai_executive_brain_runtime to service_role;
grant select, insert, update on table growth.ai_executive_mission_state to service_role;
grant select, insert, update on table growth.ai_executive_delegations to service_role;
grant select, insert on table growth.ai_executive_heartbeat_events to service_role;
grant select, insert on table growth.ai_executive_event_observations to service_role;

alter table growth.ai_executive_brain_runtime enable row level security;
alter table growth.ai_executive_brain_runtime force row level security;
alter table growth.ai_executive_mission_state enable row level security;
alter table growth.ai_executive_mission_state force row level security;
alter table growth.ai_executive_delegations enable row level security;
alter table growth.ai_executive_delegations force row level security;
alter table growth.ai_executive_heartbeat_events enable row level security;
alter table growth.ai_executive_heartbeat_events force row level security;
alter table growth.ai_executive_event_observations enable row level security;
alter table growth.ai_executive_event_observations force row level security;

drop policy if exists ai_executive_brain_runtime_service_role on growth.ai_executive_brain_runtime;
create policy ai_executive_brain_runtime_service_role
  on growth.ai_executive_brain_runtime for all to service_role using (true) with check (true);

drop policy if exists ai_executive_mission_state_service_role on growth.ai_executive_mission_state;
create policy ai_executive_mission_state_service_role
  on growth.ai_executive_mission_state for all to service_role using (true) with check (true);

drop policy if exists ai_executive_delegations_service_role on growth.ai_executive_delegations;
create policy ai_executive_delegations_service_role
  on growth.ai_executive_delegations for all to service_role using (true) with check (true);

drop policy if exists ai_executive_heartbeat_events_service_role on growth.ai_executive_heartbeat_events;
create policy ai_executive_heartbeat_events_service_role
  on growth.ai_executive_heartbeat_events for all to service_role using (true) with check (true);

drop policy if exists ai_executive_event_observations_service_role on growth.ai_executive_event_observations;
create policy ai_executive_event_observations_service_role
  on growth.ai_executive_event_observations for all to service_role using (true) with check (true);
