-- Growth Engine Apollo Pilot Operations — cohort registry + company membership.
-- Analytics and controls only. No autonomous outreach, send, or enrollment on cohort create.

do $$
begin
  if to_regclass('growth.apollo_enrollment_candidates') is null then
    raise exception 'Missing dependency: growth.apollo_enrollment_candidates';
  end if;
end;
$$;

create table if not exists growth.apollo_pilot_cohorts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  cohort_name text not null,
  target_company_count integer not null default 25
    check (target_company_count in (25, 50, 100)),
  company_count integer not null default 0 check (company_count >= 0),
  contact_count integer not null default 0 check (contact_count >= 0),

  created_by uuid,
  created_by_email text,

  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'completed', 'cancelled')),

  started_at timestamptz,
  paused_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists apollo_pilot_cohorts_status_idx
  on growth.apollo_pilot_cohorts (status, created_at desc);

create table if not exists growth.apollo_pilot_cohort_companies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  cohort_id uuid not null references growth.apollo_pilot_cohorts (id) on delete cascade,
  company_candidate_id uuid not null,
  company_name text not null default '',
  domain text,

  qualification_status text not null default 'unknown',
  sequence_ready_count integer not null default 0 check (sequence_ready_count >= 0),
  enrollment_candidate_count integer not null default 0 check (enrollment_candidate_count >= 0),
  sequence_enrollment_count integer not null default 0 check (sequence_enrollment_count >= 0),

  status text not null default 'active'
    check (status in ('active', 'removed', 'completed')),

  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists apollo_pilot_cohort_companies_unique
  on growth.apollo_pilot_cohort_companies (cohort_id, company_candidate_id);

create index if not exists apollo_pilot_cohort_companies_cohort_idx
  on growth.apollo_pilot_cohort_companies (cohort_id, status, created_at desc);

create index if not exists apollo_pilot_cohort_companies_company_idx
  on growth.apollo_pilot_cohort_companies (company_candidate_id);

revoke all on table growth.apollo_pilot_cohorts from public, anon, authenticated;
grant select, insert, update, delete on table growth.apollo_pilot_cohorts to service_role;
alter table growth.apollo_pilot_cohorts enable row level security;

revoke all on table growth.apollo_pilot_cohort_companies from public, anon, authenticated;
grant select, insert, update, delete on table growth.apollo_pilot_cohort_companies to service_role;
alter table growth.apollo_pilot_cohort_companies enable row level security;

comment on table growth.apollo_pilot_cohorts is
  'Apollo pilot cohort registry — draft/active/paused/completed/cancelled. No outreach on create.';

comment on table growth.apollo_pilot_cohort_companies is
  'Company membership for Apollo pilot cohorts — duplicate company prevented per cohort.';
