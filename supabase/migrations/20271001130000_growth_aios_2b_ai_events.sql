-- GE-AIOS-2B — AI Event Foundation (Equipify AI OS constitutional event bus).
-- Constitutional reference: AI Revenue Operator Constitution v1.0 §11.5, §17.8.
-- Immutable append-only events — NOT notifications, websockets, or realtime UI.

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
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.ai_os_events — immutable canonical event log
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_os_events (
  id uuid primary key default gen_random_uuid(),

  event_type text not null,
  event_version int not null default 1 check (event_version >= 1),
  schema_version text not null default '1.0',

  category text not null
    check (category in (
      'mission',
      'work_order',
      'decision',
      'memory',
      'learning',
      'agent',
      'executive',
      'provider',
      'health',
      'approval',
      'budget',
      'deliverability',
      'conversation',
      'opportunity',
      'system'
    )),

  organization_id uuid not null references public.organizations (id) on delete cascade,
  mission_id uuid references growth.organization_growth_objectives (id) on delete set null,
  work_order_id uuid references growth.ai_work_orders (id) on delete set null,

  agent_owner text,
  entity_type text,
  entity_id uuid,

  correlation_id uuid not null,
  causation_id uuid,

  priority int not null default 500 check (priority >= 0 and priority <= 1000),

  producer text not null,
  source text not null,

  payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  audit_metadata jsonb not null default '{}'::jsonb,

  lifecycle text not null default 'published'
    check (lifecycle in ('created', 'published', 'archived')),

  replayable boolean not null default true,
  replay_key text,

  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  qa_marker text not null default 'growth-aios-2b-ai-event-v1',

  constraint ai_os_events_agent_owner_check check (
    agent_owner is null or agent_owner in (
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
  )
);

create index if not exists ai_os_events_org_occurred_idx
  on growth.ai_os_events (organization_id, occurred_at desc);

create index if not exists ai_os_events_correlation_idx
  on growth.ai_os_events (organization_id, correlation_id, occurred_at desc);

create index if not exists ai_os_events_mission_idx
  on growth.ai_os_events (mission_id, occurred_at desc)
  where mission_id is not null;

create index if not exists ai_os_events_work_order_idx
  on growth.ai_os_events (work_order_id, occurred_at desc)
  where work_order_id is not null;

create index if not exists ai_os_events_category_type_idx
  on growth.ai_os_events (organization_id, category, event_type, occurred_at desc);

create unique index if not exists ai_os_events_replay_key_uidx
  on growth.ai_os_events (organization_id, replay_key)
  where replay_key is not null and replay_key <> '';

comment on table growth.ai_os_events is
  'GE-AIOS-2B immutable AI OS event log — insert-only; corrections emit new rows with causation_id.';

-- -----------------------------------------------------------------------------
-- growth.ai_os_event_subscriptions — consumer registration
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_os_event_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  subscriber_id text not null,
  subscriber_kind text not null default 'internal'
    check (subscriber_kind in ('internal', 'audit', 'bridge', 'future')),

  categories text[] not null default '{}'::text[],
  event_type_prefixes text[] not null default '{}'::text[],

  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,

  qa_marker text not null default 'growth-aios-2b-ai-event-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, subscriber_id)
);

create index if not exists ai_os_event_subscriptions_org_enabled_idx
  on growth.ai_os_event_subscriptions (organization_id, enabled);

comment on table growth.ai_os_event_subscriptions is
  'GE-AIOS-2B AI OS event subscriber registry — pull/dispatch targets without direct service coupling.';

-- -----------------------------------------------------------------------------
-- growth.ai_os_event_deliveries — per-subscriber consumption state
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_os_event_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references growth.ai_os_events (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  subscription_id uuid not null references growth.ai_os_event_subscriptions (id) on delete cascade,
  subscriber_id text not null,

  status text not null default 'pending'
    check (status in ('pending', 'consumed', 'archived')),

  consumed_at timestamptz,
  archived_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  unique (event_id, subscription_id)
);

create index if not exists ai_os_event_deliveries_subscriber_status_idx
  on growth.ai_os_event_deliveries (organization_id, subscriber_id, status, created_at asc);

create index if not exists ai_os_event_deliveries_event_idx
  on growth.ai_os_event_deliveries (event_id);

comment on table growth.ai_os_event_deliveries is
  'GE-AIOS-2B delivery ledger — consumed/archived tracked here; parent event remains immutable.';

-- -----------------------------------------------------------------------------
-- growth.ai_os_event_archive_records — append-only archive index (no event updates)
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_os_event_archive_records (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references growth.ai_os_events (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reason text not null default '',
  archived_by text,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz not null default now()
);

create index if not exists ai_os_event_archive_records_event_idx
  on growth.ai_os_event_archive_records (event_id);

comment on table growth.ai_os_event_archive_records is
  'GE-AIOS-2B append-only archive index — marks events archived without mutating ai_os_events rows.';

drop trigger if exists trg_growth_ai_os_event_subscriptions_updated_at
  on growth.ai_os_event_subscriptions;
create trigger trg_growth_ai_os_event_subscriptions_updated_at
  before update on growth.ai_os_event_subscriptions
  for each row execute function public.set_updated_at();

revoke all on table growth.ai_os_events from public, anon, authenticated;
grant select, insert on table growth.ai_os_events to service_role;

revoke all on table growth.ai_os_event_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on table growth.ai_os_event_subscriptions to service_role;

revoke all on table growth.ai_os_event_deliveries from public, anon, authenticated;
grant select, insert, update on table growth.ai_os_event_deliveries to service_role;

revoke all on table growth.ai_os_event_archive_records from public, anon, authenticated;
grant select, insert on table growth.ai_os_event_archive_records to service_role;

alter table growth.ai_os_events enable row level security;
alter table growth.ai_os_events force row level security;

alter table growth.ai_os_event_subscriptions enable row level security;
alter table growth.ai_os_event_subscriptions force row level security;

alter table growth.ai_os_event_deliveries enable row level security;
alter table growth.ai_os_event_deliveries force row level security;

alter table growth.ai_os_event_archive_records enable row level security;
alter table growth.ai_os_event_archive_records force row level security;

drop policy if exists growth_ai_os_events_service_role on growth.ai_os_events;
create policy growth_ai_os_events_service_role
  on growth.ai_os_events for all to service_role using (true) with check (true);

drop policy if exists growth_ai_os_event_subscriptions_service_role on growth.ai_os_event_subscriptions;
create policy growth_ai_os_event_subscriptions_service_role
  on growth.ai_os_event_subscriptions for all to service_role using (true) with check (true);

drop policy if exists growth_ai_os_event_deliveries_service_role on growth.ai_os_event_deliveries;
create policy growth_ai_os_event_deliveries_service_role
  on growth.ai_os_event_deliveries for all to service_role using (true) with check (true);

drop policy if exists growth_ai_os_event_archive_records_service_role on growth.ai_os_event_archive_records;
create policy growth_ai_os_event_archive_records_service_role
  on growth.ai_os_event_archive_records for all to service_role using (true) with check (true);
