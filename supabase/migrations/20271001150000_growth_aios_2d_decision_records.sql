-- GE-AIOS-2D — Decision Record foundation (Equipify AI OS).
-- Constitutional reference: AI Revenue Operator Constitution v1.0 §7, §16.2, §17.12–13.
-- Immutable append-only decision audit trail — NOT AI reasoning or Decision Engine logic.

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
-- growth.ai_decision_records — immutable constitutional decision log
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_decision_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  mission_id uuid not null references growth.organization_growth_objectives (id) on delete cascade,
  work_order_id uuid references growth.ai_work_orders (id) on delete set null,

  decision_key text not null,
  owner_agent text not null,

  entity_type text,
  entity_id uuid,

  evidence_bundle jsonb not null default '[]'::jsonb,
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 100),
  risk_score numeric not null default 0 check (risk_score >= 0 and risk_score <= 100),
  expected_cost_usd numeric not null default 0,
  expected_roi numeric,
  expected_value_usd numeric,

  explanation text not null default '',
  chosen_action jsonb not null default '{}'::jsonb,
  rejected_actions jsonb not null default '[]'::jsonb,
  outcome jsonb,
  operator_override jsonb,
  learning jsonb not null default '{}'::jsonb,

  supersedes_decision_id uuid references growth.ai_decision_records (id) on delete set null,
  schema_version text not null default '1.0',

  audit_metadata jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-aios-2d-decision-record-v1',
  created_at timestamptz not null default now(),

  constraint ai_decision_records_owner_agent_check check (
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
  )
);

create index if not exists ai_decision_records_org_mission_idx
  on growth.ai_decision_records (organization_id, mission_id, created_at desc);

create index if not exists ai_decision_records_work_order_idx
  on growth.ai_decision_records (work_order_id, created_at desc)
  where work_order_id is not null;

create index if not exists ai_decision_records_decision_key_idx
  on growth.ai_decision_records (organization_id, decision_key, created_at desc);

create index if not exists ai_decision_records_entity_idx
  on growth.ai_decision_records (organization_id, entity_type, entity_id, created_at desc)
  where entity_id is not null;

create index if not exists ai_decision_records_supersedes_idx
  on growth.ai_decision_records (supersedes_decision_id)
  where supersedes_decision_id is not null;

comment on table growth.ai_decision_records is
  'GE-AIOS-2D immutable Decision Records — insert-only; corrections emit new rows with supersedes_decision_id.';

-- -----------------------------------------------------------------------------
-- growth.ai_decision_record_audit_events — lifecycle audit (immutable)
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_decision_record_audit_events (
  id uuid primary key default gen_random_uuid(),
  decision_record_id uuid not null references growth.ai_decision_records (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  event_type text not null
    check (event_type in ('created', 'linked', 'superseded', 'referenced')),
  work_order_id uuid references growth.ai_work_orders (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_decision_record_audit_events_decision_idx
  on growth.ai_decision_record_audit_events (decision_record_id, created_at desc);

create index if not exists ai_decision_record_audit_events_org_idx
  on growth.ai_decision_record_audit_events (organization_id, created_at desc);

comment on table growth.ai_decision_record_audit_events is
  'GE-AIOS-2D append-only Decision Record lifecycle audit trail.';

revoke all on table growth.ai_decision_records from public, anon, authenticated;
grant select, insert on table growth.ai_decision_records to service_role;

revoke all on table growth.ai_decision_record_audit_events from public, anon, authenticated;
grant select, insert on table growth.ai_decision_record_audit_events to service_role;

alter table growth.ai_decision_records enable row level security;
alter table growth.ai_decision_records force row level security;

alter table growth.ai_decision_record_audit_events enable row level security;
alter table growth.ai_decision_record_audit_events force row level security;

drop policy if exists growth_ai_decision_records_service_role on growth.ai_decision_records;
create policy growth_ai_decision_records_service_role
  on growth.ai_decision_records for all to service_role using (true) with check (true);

drop policy if exists growth_ai_decision_record_audit_events_service_role on growth.ai_decision_record_audit_events;
create policy growth_ai_decision_record_audit_events_service_role
  on growth.ai_decision_record_audit_events for all to service_role using (true) with check (true);
