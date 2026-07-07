-- GE-AVA-PERSISTENCE-1 — Durable storage for GE-AIOS-GROWTH-5F outreach preparation pilot.
-- Replaces in-memory org/run Map with Supabase persistence. Service-role only.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.autonomous_outreach_preparation_pilot_states — org control plane
-- -----------------------------------------------------------------------------

create table if not exists growth.autonomous_outreach_preparation_pilot_states (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  control_state text not null default 'disabled'
    check (control_state in ('active', 'paused', 'disabled')),
  updated_at timestamptz not null default now(),
  qa_marker text not null default 'ge-ava-persistence-1-v1'
);

comment on table growth.autonomous_outreach_preparation_pilot_states is
  'GE-AVA-PERSISTENCE-1 — per-org outreach preparation pilot control state (replaces in-memory store).';

-- -----------------------------------------------------------------------------
-- growth.autonomous_outreach_preparation_runs — run ledger + approval packages
-- -----------------------------------------------------------------------------

create table if not exists growth.autonomous_outreach_preparation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  run_id text not null,
  lead_id uuid not null,
  company_name text,
  wake_condition text not null
    check (wake_condition in (
      'execution_completed',
      'stale_outreach_package',
      'manual_outreach_preparation_request'
    )),
  outcome text not null
    check (outcome in ('completed', 'failed', 'skipped')),
  started_at timestamptz not null,
  completed_at timestamptz not null,
  duration_ms integer not null default 1800,
  package_id text,
  workflow_type text,
  confidence numeric,
  skip_reason text,
  block_reason text,
  revenue_operator_handoff text,
  approval_package jsonb,
  qa_marker text not null default 'ge-ava-persistence-1-v1',
  created_at timestamptz not null default now(),
  constraint autonomous_outreach_preparation_runs_org_run_uidx
    unique (organization_id, run_id)
);

create index if not exists autonomous_outreach_preparation_runs_org_completed_idx
  on growth.autonomous_outreach_preparation_runs (organization_id, completed_at desc);

create index if not exists autonomous_outreach_preparation_runs_org_package_idx
  on growth.autonomous_outreach_preparation_runs (organization_id, package_id)
  where package_id is not null;

create index if not exists autonomous_outreach_preparation_runs_org_lead_idx
  on growth.autonomous_outreach_preparation_runs (organization_id, lead_id, completed_at desc);

create index if not exists autonomous_outreach_preparation_runs_approval_package_id_idx
  on growth.autonomous_outreach_preparation_runs (organization_id, ((approval_package ->> 'packageId')))
  where approval_package is not null;

comment on table growth.autonomous_outreach_preparation_runs is
  'GE-AVA-PERSISTENCE-1 — outreach preparation run records with embedded approval packages (JSONB).';

-- -----------------------------------------------------------------------------
-- Grants + RLS (service_role only — matches other Growth pilot tables)
-- -----------------------------------------------------------------------------

grant select, insert, update, delete on table growth.autonomous_outreach_preparation_pilot_states to service_role;
grant select, insert, update, delete on table growth.autonomous_outreach_preparation_runs to service_role;

alter table growth.autonomous_outreach_preparation_pilot_states enable row level security;
alter table growth.autonomous_outreach_preparation_pilot_states force row level security;

alter table growth.autonomous_outreach_preparation_runs enable row level security;
alter table growth.autonomous_outreach_preparation_runs force row level security;

drop policy if exists growth_autonomous_outreach_preparation_pilot_states_service_role
  on growth.autonomous_outreach_preparation_pilot_states;
create policy growth_autonomous_outreach_preparation_pilot_states_service_role
  on growth.autonomous_outreach_preparation_pilot_states for all to service_role using (true) with check (true);

drop policy if exists growth_autonomous_outreach_preparation_runs_service_role
  on growth.autonomous_outreach_preparation_runs;
create policy growth_autonomous_outreach_preparation_runs_service_role
  on growth.autonomous_outreach_preparation_runs for all to service_role using (true) with check (true);
