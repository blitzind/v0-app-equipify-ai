-- GE-AI-3D-PROD-1 — Durable Closed-Loop Learning Store (advisory only).
-- Organization-scoped, audited, service-role only — NOT Core mutations.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.closed_loop_learning_outcomes
-- -----------------------------------------------------------------------------

create table if not exists growth.closed_loop_learning_outcomes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  source text not null,
  outcome_type text not null,
  subject_type text not null,
  subject_id text not null,

  related jsonb not null default '{}'::jsonb,
  signal_strength numeric(5, 4) not null default 0,
  confidence numeric(5, 4) not null default 0,
  dimensions jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '[]'::jsonb,

  occurred_at timestamptz not null,
  idempotency_key text not null,

  audit_metadata jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-ge-ai-3d-prod-1-durable-closed-loop-learning-v1',

  created_at timestamptz not null default now()
);

create unique index if not exists closed_loop_learning_outcomes_idempotency_uidx
  on growth.closed_loop_learning_outcomes (organization_id, idempotency_key);

create index if not exists closed_loop_learning_outcomes_org_occurred_idx
  on growth.closed_loop_learning_outcomes (organization_id, occurred_at desc);

create index if not exists closed_loop_learning_outcomes_org_source_idx
  on growth.closed_loop_learning_outcomes (organization_id, source, outcome_type);

comment on table growth.closed_loop_learning_outcomes is
  'GE-AI-3D-PROD-1 normalized learning outcomes — idempotent per organization, advisory only.';

-- -----------------------------------------------------------------------------
-- growth.closed_loop_learning_insights
-- -----------------------------------------------------------------------------

create table if not exists growth.closed_loop_learning_insights (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  insight_type text not null,
  title text not null,
  summary text not null default '',
  recommended_adjustment text not null default 'monitor',
  target_system text not null,

  confidence numeric(5, 4) not null default 0,
  impact numeric(5, 4) not null default 0,
  sample_size integer not null default 0,
  evidence jsonb not null default '[]'::jsonb,
  status text not null default 'not_enough_data'
    check (status in ('advisory', 'needs_review', 'not_enough_data')),

  generated_from_window text not null,
  idempotency_key text not null,

  audit_metadata jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-ge-ai-3d-prod-1-durable-closed-loop-learning-v1',

  created_at timestamptz not null default now(),
  superseded_at timestamptz
);

create unique index if not exists closed_loop_learning_insights_idempotency_uidx
  on growth.closed_loop_learning_insights (organization_id, idempotency_key);

create index if not exists closed_loop_learning_insights_org_active_idx
  on growth.closed_loop_learning_insights (organization_id, insight_type, created_at desc)
  where superseded_at is null;

comment on table growth.closed_loop_learning_insights is
  'GE-AI-3D-PROD-1 advisory learning insights — idempotent per organization window.';

-- -----------------------------------------------------------------------------
-- growth.closed_loop_learning_events
-- -----------------------------------------------------------------------------

create table if not exists growth.closed_loop_learning_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  outcome_id uuid references growth.closed_loop_learning_outcomes (id) on delete set null,
  insight_id uuid references growth.closed_loop_learning_insights (id) on delete set null,

  event_type text not null,
  payload jsonb not null default '{}'::jsonb,

  qa_marker text not null default 'growth-ge-ai-3d-prod-1-durable-closed-loop-learning-v1',
  created_at timestamptz not null default now()
);

create index if not exists closed_loop_learning_events_org_type_idx
  on growth.closed_loop_learning_events (organization_id, event_type, created_at desc);

create index if not exists closed_loop_learning_events_outcome_idx
  on growth.closed_loop_learning_events (outcome_id, created_at desc);

create index if not exists closed_loop_learning_events_insight_idx
  on growth.closed_loop_learning_events (insight_id, created_at desc);

comment on table growth.closed_loop_learning_events is
  'GE-AI-3D-PROD-1 append-only closed-loop learning audit trail.';

-- -----------------------------------------------------------------------------
-- RLS — service_role only
-- -----------------------------------------------------------------------------

revoke all on table growth.closed_loop_learning_outcomes from public, anon, authenticated;
revoke all on table growth.closed_loop_learning_insights from public, anon, authenticated;
revoke all on table growth.closed_loop_learning_events from public, anon, authenticated;

grant select, insert, update, delete on table growth.closed_loop_learning_outcomes to service_role;
grant select, insert, update, delete on table growth.closed_loop_learning_insights to service_role;
grant select, insert on table growth.closed_loop_learning_events to service_role;

alter table growth.closed_loop_learning_outcomes enable row level security;
alter table growth.closed_loop_learning_outcomes force row level security;

alter table growth.closed_loop_learning_insights enable row level security;
alter table growth.closed_loop_learning_insights force row level security;

alter table growth.closed_loop_learning_events enable row level security;
alter table growth.closed_loop_learning_events force row level security;

drop policy if exists growth_closed_loop_learning_outcomes_service_role on growth.closed_loop_learning_outcomes;
create policy growth_closed_loop_learning_outcomes_service_role
  on growth.closed_loop_learning_outcomes for all to service_role using (true) with check (true);

drop policy if exists growth_closed_loop_learning_insights_service_role on growth.closed_loop_learning_insights;
create policy growth_closed_loop_learning_insights_service_role
  on growth.closed_loop_learning_insights for all to service_role using (true) with check (true);

drop policy if exists growth_closed_loop_learning_events_service_role on growth.closed_loop_learning_events;
create policy growth_closed_loop_learning_events_service_role
  on growth.closed_loop_learning_events for all to service_role using (true) with check (true);
