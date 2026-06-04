-- Growth Engine Phase 7.7A — Buying committee intelligence foundation (canonical company scoped).
-- Note: Prompt 27 contact discovery uses growth.buying_committees / buying_committee_members (contact_candidates).
-- Phase 7.7A canonical assignments: growth.buying_committee_intelligence_members.

do $$
begin
  if to_regclass('growth.companies') is null then
    raise exception 'Missing dependency: growth.companies';
  end if;
  if to_regclass('growth.persons') is null then
    raise exception 'Missing dependency: growth.persons';
  end if;
end;
$$;

-- Expand canonical employment roles for committee promotion alignment.
alter table growth.person_company_roles drop constraint if exists person_company_roles_role_type_check;
alter table growth.person_company_roles add constraint person_company_roles_role_type_check
  check (role_type in (
    'owner',
    'economic_buyer',
    'decision_maker',
    'technical_buyer',
    'champion',
    'operator',
    'influencer',
    'end_user',
    'executive_sponsor',
    'procurement',
    'blocker_risk_stakeholder',
    'unknown'
  ));

-- -----------------------------------------------------------------------------
-- growth.buying_committee_runs
-- -----------------------------------------------------------------------------

create table if not exists growth.buying_committee_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  company_id uuid not null references growth.companies (id) on delete cascade,
  created_by uuid,

  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'partial', 'failed')),
  provider_summary text not null default '',
  started_at timestamptz,
  completed_at timestamptz,
  member_count int not null default 0,
  verified_count int not null default 0,
  promoted_count int not null default 0,
  coverage_score numeric not null default 0
    check (coverage_score >= 0 and coverage_score <= 1),
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists buying_committee_runs_company_idx
  on growth.buying_committee_runs (company_id, created_at desc);

-- -----------------------------------------------------------------------------
-- growth.buying_committee_evidence — auditable evidence per run assignment
-- -----------------------------------------------------------------------------

create table if not exists growth.buying_committee_evidence (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  run_id uuid not null references growth.buying_committee_runs (id) on delete cascade,
  company_id uuid not null references growth.companies (id) on delete cascade,
  person_id uuid not null references growth.persons (id) on delete cascade,

  assignment_ref uuid not null default gen_random_uuid(),
  committee_role text not null default ''
    check (committee_role in (
      'economic_buyer',
      'technical_buyer',
      'champion',
      'influencer',
      'end_user',
      'executive_sponsor',
      'procurement',
      'blocker_risk_stakeholder'
    )),

  evidence_type text not null default 'observation'
    check (evidence_type in (
      'canonical_role',
      'staging_contact',
      'confirmed_decision_maker',
      'title_pattern',
      'metadata_declared',
      'verification',
      'operator_note'
    )),

  source_url text,
  source_record_id text,
  extraction_method text not null default '',
  evidence_text text not null default '',
  proposed_person_name text,
  proposed_job_title text,
  confidence numeric not null default 0
    check (confidence >= 0 and confidence <= 1),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists buying_committee_evidence_run_idx
  on growth.buying_committee_evidence (run_id, assignment_ref);

create index if not exists buying_committee_evidence_company_idx
  on growth.buying_committee_evidence (company_id, committee_role);

-- -----------------------------------------------------------------------------
-- growth.buying_committee_intelligence_members — canonical evidence-backed committee store
-- (7.7A spec: buying committee members; distinct from Prompt 27 buying_committee_members)
-- -----------------------------------------------------------------------------

create table if not exists growth.buying_committee_intelligence_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  company_id uuid not null references growth.companies (id) on delete cascade,
  person_id uuid not null references growth.persons (id) on delete cascade,
  committee_role text not null default ''
    check (committee_role in (
      'economic_buyer',
      'technical_buyer',
      'champion',
      'influencer',
      'end_user',
      'executive_sponsor',
      'procurement',
      'blocker_risk_stakeholder'
    )),
  normalized_assignment_key text not null default '',

  full_name text not null default '',
  job_title text,
  confidence numeric not null default 0
    check (confidence >= 0 and confidence <= 1),
  verification_status text not null default 'observed'
    check (verification_status in (
      'unverified',
      'probable',
      'verified',
      'invalid',
      'superseded'
    )),

  source_table text not null default 'buying_committee_runs',
  source_run_id uuid references growth.buying_committee_runs (id) on delete set null,
  source_evidence_ids uuid[] not null default '{}',
  provider_name text not null default '',
  discovery_source text not null default '',
  observed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table growth.buying_committee_intelligence_members
  add constraint buying_committee_intelligence_members_company_person_role_unique
  unique (company_id, person_id, committee_role);

create index if not exists buying_committee_intelligence_members_company_idx
  on growth.buying_committee_intelligence_members (company_id, committee_role);

drop trigger if exists trg_growth_buying_committee_runs_updated_at on growth.buying_committee_runs;
create trigger trg_growth_buying_committee_runs_updated_at
  before update on growth.buying_committee_runs
  for each row execute function public.set_updated_at();

drop trigger if exists trg_growth_buying_committee_intelligence_members_updated_at
  on growth.buying_committee_intelligence_members;
create trigger trg_growth_buying_committee_intelligence_members_updated_at
  before update on growth.buying_committee_intelligence_members
  for each row execute function public.set_updated_at();

revoke all on table growth.buying_committee_runs from public, anon, authenticated;
revoke all on table growth.buying_committee_evidence from public, anon, authenticated;
revoke all on table growth.buying_committee_intelligence_members from public, anon, authenticated;

grant select, insert, update, delete on table growth.buying_committee_runs to service_role;
grant select, insert, update, delete on table growth.buying_committee_evidence to service_role;
grant select, insert, update, delete on table growth.buying_committee_intelligence_members to service_role;

alter table growth.buying_committee_runs enable row level security;
alter table growth.buying_committee_evidence enable row level security;
alter table growth.buying_committee_intelligence_members enable row level security;

comment on table growth.buying_committee_runs is
  'Phase 7.7A buying committee intelligence orchestration per canonical company (sync HTTP only in 7.7A).';
comment on table growth.buying_committee_evidence is
  'Auditable evidence for each committee role assignment; every promoted member must trace to evidence rows.';
comment on table growth.buying_committee_intelligence_members is
  'Canonical evidence-backed buying committee assignments (no AI people, no title guessing without evidence).';
