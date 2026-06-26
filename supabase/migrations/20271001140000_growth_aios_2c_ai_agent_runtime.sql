-- GE-AIOS-2C — AI Agent Runtime foundation (Equipify AI OS).
-- Constitutional reference: AI Revenue Operator Constitution v1.0 §12.2, §12.3.
-- Infrastructure only — no Executive Brain, Decision Engine, or business logic.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
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
-- growth.ai_os_agent_registrations
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_os_agent_registrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  agent_key text not null,
  instance_id text not null,

  runtime_status text not null default 'idle'
    check (runtime_status in (
      'sleeping',
      'idle',
      'planning',
      'working',
      'waiting',
      'monitoring',
      'escalated',
      'recovery',
      'completed'
    )),

  health_status text not null default 'healthy'
    check (health_status in ('healthy', 'degraded', 'unhealthy', 'offline')),

  active_lease_count int not null default 0 check (active_lease_count >= 0),
  max_concurrent_leases int not null default 1 check (max_concurrent_leases >= 1),

  last_heartbeat_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-aios-2c-ai-agent-runtime-v1',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, agent_key, instance_id),

  constraint ai_os_agent_registrations_agent_key_check check (
    agent_key in (
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
  )
);

create index if not exists ai_os_agent_registrations_org_agent_idx
  on growth.ai_os_agent_registrations (organization_id, agent_key);

create index if not exists ai_os_agent_registrations_heartbeat_idx
  on growth.ai_os_agent_registrations (organization_id, last_heartbeat_at desc);

comment on table growth.ai_os_agent_registrations is
  'GE-AIOS-2C constitutional agent runtime registrations — instance + heartbeat state.';

-- -----------------------------------------------------------------------------
-- growth.ai_os_agent_capabilities
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_os_agent_capabilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  agent_key text not null,

  work_order_type text not null,
  enabled boolean not null default true,
  max_concurrent int not null default 1 check (max_concurrent >= 1),
  metadata jsonb not null default '{}'::jsonb,

  qa_marker text not null default 'growth-aios-2c-ai-agent-runtime-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, agent_key, work_order_type),

  constraint ai_os_agent_capabilities_agent_key_check check (
    agent_key in (
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
  constraint ai_os_agent_capabilities_work_order_type_check check (
    work_order_type in (
      'research_company',
      'generate_buying_committee',
      'verify_email',
      'generate_email',
      'generate_video',
      'enroll_sequence',
      'pause_sequence',
      'analyze_reply',
      'prepare_meeting',
      'create_opportunity',
      'update_memory',
      'run_learning_cycle',
      'custom'
    )
  )
);

create index if not exists ai_os_agent_capabilities_org_agent_idx
  on growth.ai_os_agent_capabilities (organization_id, agent_key, enabled);

comment on table growth.ai_os_agent_capabilities is
  'GE-AIOS-2C agent capability registry — advertised work order types per agent.';

-- -----------------------------------------------------------------------------
-- growth.ai_os_agent_leases — work order claim leases
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_os_agent_leases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  work_order_id uuid not null references growth.ai_work_orders (id) on delete cascade,
  agent_registration_id uuid not null references growth.ai_os_agent_registrations (id) on delete cascade,

  agent_key text not null,
  instance_id text not null,

  status text not null default 'active'
    check (status in ('active', 'released', 'expired', 'failed', 'escalated')),

  leased_at timestamptz not null default now(),
  expires_at timestamptz not null,
  released_at timestamptz,
  release_reason text,

  metadata jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-aios-2c-ai-agent-runtime-v1',
  created_at timestamptz not null default now(),

  constraint ai_os_agent_leases_agent_key_check check (
    agent_key in (
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
  )
);

create unique index if not exists ai_os_agent_leases_active_work_order_uidx
  on growth.ai_os_agent_leases (work_order_id)
  where status = 'active';

create index if not exists ai_os_agent_leases_agent_active_idx
  on growth.ai_os_agent_leases (organization_id, agent_key, instance_id, status);

create index if not exists ai_os_agent_leases_expires_idx
  on growth.ai_os_agent_leases (expires_at)
  where status = 'active';

comment on table growth.ai_os_agent_leases is
  'GE-AIOS-2C work order leases — one active lease per work order.';

-- -----------------------------------------------------------------------------
-- growth.ai_os_agent_heartbeat_events — append-only heartbeat audit
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_os_agent_heartbeat_events (
  id uuid primary key default gen_random_uuid(),
  agent_registration_id uuid not null references growth.ai_os_agent_registrations (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  agent_key text not null,
  instance_id text not null,
  runtime_status text not null,
  health_status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_os_agent_heartbeat_events_agent_idx
  on growth.ai_os_agent_heartbeat_events (agent_registration_id, created_at desc);

comment on table growth.ai_os_agent_heartbeat_events is
  'GE-AIOS-2C append-only agent heartbeat audit trail.';

drop trigger if exists trg_growth_ai_os_agent_registrations_updated_at
  on growth.ai_os_agent_registrations;
create trigger trg_growth_ai_os_agent_registrations_updated_at
  before update on growth.ai_os_agent_registrations
  for each row execute function public.set_updated_at();

drop trigger if exists trg_growth_ai_os_agent_capabilities_updated_at
  on growth.ai_os_agent_capabilities;
create trigger trg_growth_ai_os_agent_capabilities_updated_at
  before update on growth.ai_os_agent_capabilities
  for each row execute function public.set_updated_at();

revoke all on table growth.ai_os_agent_registrations from public, anon, authenticated;
grant select, insert, update, delete on table growth.ai_os_agent_registrations to service_role;

revoke all on table growth.ai_os_agent_capabilities from public, anon, authenticated;
grant select, insert, update, delete on table growth.ai_os_agent_capabilities to service_role;

revoke all on table growth.ai_os_agent_leases from public, anon, authenticated;
grant select, insert, update on table growth.ai_os_agent_leases to service_role;

revoke all on table growth.ai_os_agent_heartbeat_events from public, anon, authenticated;
grant select, insert on table growth.ai_os_agent_heartbeat_events to service_role;

alter table growth.ai_os_agent_registrations enable row level security;
alter table growth.ai_os_agent_registrations force row level security;

alter table growth.ai_os_agent_capabilities enable row level security;
alter table growth.ai_os_agent_capabilities force row level security;

alter table growth.ai_os_agent_leases enable row level security;
alter table growth.ai_os_agent_leases force row level security;

alter table growth.ai_os_agent_heartbeat_events enable row level security;
alter table growth.ai_os_agent_heartbeat_events force row level security;

drop policy if exists growth_ai_os_agent_registrations_service_role on growth.ai_os_agent_registrations;
create policy growth_ai_os_agent_registrations_service_role
  on growth.ai_os_agent_registrations for all to service_role using (true) with check (true);

drop policy if exists growth_ai_os_agent_capabilities_service_role on growth.ai_os_agent_capabilities;
create policy growth_ai_os_agent_capabilities_service_role
  on growth.ai_os_agent_capabilities for all to service_role using (true) with check (true);

drop policy if exists growth_ai_os_agent_leases_service_role on growth.ai_os_agent_leases;
create policy growth_ai_os_agent_leases_service_role
  on growth.ai_os_agent_leases for all to service_role using (true) with check (true);

drop policy if exists growth_ai_os_agent_heartbeat_events_service_role on growth.ai_os_agent_heartbeat_events;
create policy growth_ai_os_agent_heartbeat_events_service_role
  on growth.ai_os_agent_heartbeat_events for all to service_role using (true) with check (true);
