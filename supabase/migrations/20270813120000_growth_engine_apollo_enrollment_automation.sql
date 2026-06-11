-- Growth Engine Apollo Enrollment Automation — qualification + enrollment candidates only.
-- No draft creation, outreach execution, or autonomous send.

do $$
begin
  if to_regclass('growth.company_contacts') is null then
    raise exception 'Missing dependency: growth.company_contacts';
  end if;
end;
$$;

create table if not exists growth.apollo_enrollment_candidates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  company_candidate_id uuid not null,
  company_contact_id uuid references growth.company_contacts (id) on delete set null,
  contact_candidate_id uuid references growth.contact_candidates (id) on delete set null,
  growth_lead_id uuid references growth.leads (id) on delete set null,
  prospect_id uuid,

  status text not null default 'pending_enrollment_approval'
    check (status in (
      'pending_enrollment_approval',
      'enrollment_approved',
      'enrollment_rejected',
      'research_rerun_requested'
    )),

  qualified_for_enrollment boolean not null default false,
  qualification_reason text,
  qualification_score numeric(5, 2) not null default 0,
  fit_score numeric(5, 2),
  research_score numeric(5, 2),

  contact_snapshot jsonb not null default '{}'::jsonb,
  qualification_snapshot jsonb not null default '{}'::jsonb,
  operator_intelligence jsonb not null default '{}'::jsonb,
  source_attribution jsonb not null default '{}'::jsonb,
  acquisition_evidence jsonb not null default '{}'::jsonb,

  enrollment_approved_at timestamptz,
  enrollment_approved_by uuid,
  enrollment_approved_email text,
  enrollment_rejection_note text,

  auto_enrollment_attempted boolean not null default false,
  outreach_sent boolean not null default false,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists apollo_enrollment_candidates_status_idx
  on growth.apollo_enrollment_candidates (status, created_at desc);

create index if not exists apollo_enrollment_candidates_company_idx
  on growth.apollo_enrollment_candidates (company_candidate_id, created_at desc);

create unique index if not exists apollo_enrollment_candidates_contact_unique
  on growth.apollo_enrollment_candidates (company_contact_id)
  where company_contact_id is not null and status = 'pending_enrollment_approval';

create unique index if not exists apollo_enrollment_candidates_candidate_unique
  on growth.apollo_enrollment_candidates (contact_candidate_id)
  where contact_candidate_id is not null and status = 'pending_enrollment_approval';

create table if not exists growth.apollo_enrollment_automation_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  execution_id uuid not null,
  company_candidate_id uuid,
  status text not null default 'completed'
    check (status in ('completed', 'failed', 'partial')),

  contacts_evaluated integer not null default 0,
  contacts_qualified integer not null default 0,
  candidates_created integer not null default 0,
  candidates_skipped_duplicate integer not null default 0,
  candidates_skipped_re_enrollment integer not null default 0,

  funnel_metrics jsonb not null default '{}'::jsonb,
  blockers jsonb not null default '[]'::jsonb,

  auto_enrollment_attempted boolean not null default false,
  outreach_sent boolean not null default false,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists apollo_enrollment_automation_runs_execution_idx
  on growth.apollo_enrollment_automation_runs (execution_id, created_at desc);

revoke all on table growth.apollo_enrollment_candidates from public, anon, authenticated;
grant select, insert, update, delete on table growth.apollo_enrollment_candidates to service_role;
alter table growth.apollo_enrollment_candidates enable row level security;

revoke all on table growth.apollo_enrollment_automation_runs from public, anon, authenticated;
grant select, insert, update, delete on table growth.apollo_enrollment_automation_runs to service_role;
alter table growth.apollo_enrollment_automation_runs enable row level security;

comment on table growth.apollo_enrollment_candidates is
  'Apollo Ready For Enrollment queue. Auto-created enrollment candidates await explicit operator approval — no draft/outreach.';

comment on table growth.apollo_enrollment_automation_runs is
  'Apollo enrollment automation execution audit — qualification + candidate creation only.';
