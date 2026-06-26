-- GE-AIOS-2A — AI Work Order foundation (Equipify AI OS execution contract).
-- Constitutional reference: AI Revenue Operator Constitution v1.0 §9.2, §16.1, §17.
-- NOT Equipify Core work orders — growth.ai_work_orders only.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regclass('growth.organization_growth_objectives') is null then
    raise exception 'Missing dependency: growth.organization_growth_objectives';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.ai_work_orders
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_work_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  mission_id uuid not null references growth.organization_growth_objectives (id) on delete cascade,

  owner_agent text not null,
  assigned_agent text not null,
  work_order_type text not null,

  entity_type text,
  entity_id uuid,

  priority int not null default 500 check (priority >= 0 and priority <= 1000),
  status text not null default 'issued'
    check (status in (
      'issued',
      'planning',
      'awaiting_decision',
      'awaiting_approval',
      'executing',
      'waiting',
      'monitoring',
      'escalated',
      'completed',
      'cancelled',
      'failed'
    )),

  decision_record_ids uuid[] not null default '{}'::uuid[],
  memory_refs jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  depends_on uuid[] not null default '{}'::uuid[],

  retry_count int not null default 0 check (retry_count >= 0),
  max_retries int not null default 3 check (max_retries >= 0),
  timeout_at timestamptz,
  execution_window_start timestamptz,
  execution_window_end timestamptz,

  approval_id uuid,
  checkpoint jsonb,
  requested_by uuid,
  result jsonb,
  failure_reason text,
  audit_metadata jsonb not null default '{}'::jsonb,

  issued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  archived_at timestamptz,

  qa_marker text not null default 'growth-aios-2a-ai-work-order-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ai_work_orders_owner_agent_check check (
    owner_agent in (
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
      'deliverability',
      'executive_brain'
    )
  ),
  constraint ai_work_orders_assigned_agent_check check (
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
      'deliverability',
      'executive_brain'
    )
  ),
  constraint ai_work_orders_work_order_type_check check (
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

create index if not exists ai_work_orders_org_mission_status_idx
  on growth.ai_work_orders (organization_id, mission_id, status);

create index if not exists ai_work_orders_org_priority_idx
  on growth.ai_work_orders (organization_id, status, priority desc);

create index if not exists ai_work_orders_timeout_idx
  on growth.ai_work_orders (timeout_at)
  where status in (
    'issued',
    'planning',
    'awaiting_decision',
    'awaiting_approval',
    'executing',
    'waiting',
    'monitoring',
    'escalated'
  );

create index if not exists ai_work_orders_depends_on_gin_idx
  on growth.ai_work_orders using gin (depends_on);

comment on table growth.ai_work_orders is
  'GE-AIOS-2A AI Work Orders — constitutional execution contract for Equipify AI OS (not Core work orders).';

-- -----------------------------------------------------------------------------
-- growth.ai_work_order_events
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_work_order_events (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references growth.ai_work_orders (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  severity text not null default 'info'
    check (severity in ('info', 'low', 'medium', 'high', 'critical')),
  title text not null default '',
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_work_order_events_work_order_idx
  on growth.ai_work_order_events (work_order_id, created_at desc);

create index if not exists ai_work_order_events_org_created_idx
  on growth.ai_work_order_events (organization_id, created_at desc);

comment on table growth.ai_work_order_events is
  'GE-AIOS-2A immutable audit trail for AI Work Order lifecycle transitions.';

drop trigger if exists trg_growth_ai_work_orders_updated_at on growth.ai_work_orders;
create trigger trg_growth_ai_work_orders_updated_at
  before update on growth.ai_work_orders
  for each row execute function public.set_updated_at();

revoke all on table growth.ai_work_orders from public, anon, authenticated;
grant select, insert, update, delete on table growth.ai_work_orders to service_role;

revoke all on table growth.ai_work_order_events from public, anon, authenticated;
grant select, insert, delete on table growth.ai_work_order_events to service_role;

alter table growth.ai_work_orders enable row level security;
alter table growth.ai_work_orders force row level security;

alter table growth.ai_work_order_events enable row level security;
alter table growth.ai_work_order_events force row level security;

drop policy if exists growth_ai_work_orders_service_role on growth.ai_work_orders;
create policy growth_ai_work_orders_service_role
  on growth.ai_work_orders for all to service_role using (true) with check (true);

drop policy if exists growth_ai_work_order_events_service_role on growth.ai_work_order_events;
create policy growth_ai_work_order_events_service_role
  on growth.ai_work_order_events for all to service_role using (true) with check (true);
