-- SV1-5 — Durable Draft Factory lead state + wake receipts.
-- Minimal SoR: mutable per-org/lead progression with optimistic versioning and wake idempotency.
-- Does not replace Growth 5F, research_runs, or lead_decision_makers.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

create table if not exists growth.draft_factory_lead_states (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references growth.leads (id) on delete cascade,

  state text not null,
  earliest_incomplete_stage text,
  version integer not null default 1 check (version >= 1),

  package_id text,
  research_run_id text,
  decision_maker_id text,
  personalization_id text,

  last_wake_type text,
  last_wake_at timestamptz,
  next_eligible_wake_at timestamptz,

  attempt_counts jsonb not null default '{}'::jsonb,
  last_error_code text,
  last_error_stage text,
  paused_reason text,

  lease_owner text,
  lease_expires_at timestamptz,

  state_json jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'sv1-5-durable-event-driven-draft-factory-v1',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint draft_factory_lead_states_org_lead_unique unique (organization_id, lead_id)
);

create index if not exists draft_factory_lead_states_org_due_idx
  on growth.draft_factory_lead_states (organization_id, next_eligible_wake_at nulls first, updated_at);

create index if not exists draft_factory_lead_states_org_state_idx
  on growth.draft_factory_lead_states (organization_id, state);

create index if not exists draft_factory_lead_states_lease_expires_idx
  on growth.draft_factory_lead_states (organization_id, lease_expires_at)
  where lease_owner is not null;

create table if not exists growth.draft_factory_wake_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  wake_fingerprint text not null,
  wake_type text not null,
  outcome text not null,
  transition_summary jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'sv1-5-durable-event-driven-draft-factory-v1',
  created_at timestamptz not null default now(),

  constraint draft_factory_wake_receipts_fingerprint_unique unique (organization_id, lead_id, wake_fingerprint)
);

create index if not exists draft_factory_wake_receipts_org_lead_idx
  on growth.draft_factory_wake_receipts (organization_id, lead_id, created_at desc);

comment on table growth.draft_factory_lead_states is
  'SV1-5 durable Draft Factory progression — canonical mutable state per organization/lead.';
comment on table growth.draft_factory_wake_receipts is
  'SV1-5 wake idempotency receipts — duplicate wakes become successful no-ops.';

revoke all on table growth.draft_factory_lead_states from public, anon, authenticated;
grant select, insert, update, delete on table growth.draft_factory_lead_states to service_role;
alter table growth.draft_factory_lead_states enable row level security;
alter table growth.draft_factory_lead_states force row level security;

drop policy if exists draft_factory_lead_states_service_role on growth.draft_factory_lead_states;
create policy draft_factory_lead_states_service_role
  on growth.draft_factory_lead_states for all to service_role using (true) with check (true);

revoke all on table growth.draft_factory_wake_receipts from public, anon, authenticated;
grant select, insert, update, delete on table growth.draft_factory_wake_receipts to service_role;
alter table growth.draft_factory_wake_receipts enable row level security;
alter table growth.draft_factory_wake_receipts force row level security;

drop policy if exists draft_factory_wake_receipts_service_role on growth.draft_factory_wake_receipts;
create policy draft_factory_wake_receipts_service_role
  on growth.draft_factory_wake_receipts for all to service_role using (true) with check (true);
