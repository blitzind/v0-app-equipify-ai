-- Growth Engine Phase 7.3A — Email Discovery (canonical company + person scoped).

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

-- Allow provider-verified emails on canonical person channel rows.
alter table growth.person_emails drop constraint if exists person_emails_verification_status_check;
alter table growth.person_emails add constraint person_emails_verification_status_check
  check (verification_status in (
    'not_present',
    'unverified',
    'observed',
    'insufficient_evidence',
    'operator_verified',
    'verified',
    'rejected'
  ));

-- -----------------------------------------------------------------------------
-- growth.email_discovery_runs
-- -----------------------------------------------------------------------------

create table if not exists growth.email_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  company_id uuid not null references growth.companies (id) on delete cascade,
  person_id uuid not null references growth.persons (id) on delete cascade,
  created_by uuid,

  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'partial', 'failed')),
  provider_summary text not null default '',
  started_at timestamptz,
  completed_at timestamptz,
  candidate_count int not null default 0,
  verified_count int not null default 0,
  promoted_count int not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists email_discovery_runs_person_idx
  on growth.email_discovery_runs (person_id, created_at desc);

create index if not exists email_discovery_runs_company_idx
  on growth.email_discovery_runs (company_id, created_at desc);

-- -----------------------------------------------------------------------------
-- growth.email_discovery_candidates
-- -----------------------------------------------------------------------------

create table if not exists growth.email_discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  run_id uuid not null references growth.email_discovery_runs (id) on delete cascade,
  company_id uuid not null references growth.companies (id) on delete cascade,
  person_id uuid not null references growth.persons (id) on delete cascade,

  email text not null default '',
  normalized_email text not null default '',

  source text not null default 'unknown'
    check (source in (
      'website',
      'staging_contact',
      'pattern',
      'pdl',
      'manual',
      'unknown'
    )),
  confidence numeric not null default 0
    check (confidence >= 0 and confidence <= 1),
  confidence_tier text not null default 'low'
    check (confidence_tier in (
      'direct_evidence',
      'provider_evidence',
      'pattern_verified',
      'pattern_unverified',
      'low'
    )),

  verification_status text not null default 'unverified'
    check (verification_status in (
      'unverified',
      'verified',
      'risky',
      'invalid',
      'blocked',
      'unknown'
    )),
  verified_at timestamptz,
  verification_provider text not null default '',
  verification_reasons jsonb not null default '[]'::jsonb,

  promotion_status text not null default 'candidate'
    check (promotion_status in ('candidate', 'promoted', 'rejected', 'skipped')),
  promoted_at timestamptz,

  provider_name text not null default '',
  discovery_source text not null default '',
  metadata jsonb not null default '{}'::jsonb,

  unique (run_id, normalized_email)
);

create index if not exists email_discovery_candidates_person_idx
  on growth.email_discovery_candidates (person_id, confidence desc);

create index if not exists email_discovery_candidates_normalized_email_idx
  on growth.email_discovery_candidates (normalized_email);

-- -----------------------------------------------------------------------------
-- growth.email_discovery_evidence
-- -----------------------------------------------------------------------------

create table if not exists growth.email_discovery_evidence (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  candidate_id uuid not null references growth.email_discovery_candidates (id) on delete cascade,
  evidence_type text not null default 'observation'
    check (evidence_type in (
      'website_page',
      'website_structured',
      'staging_row',
      'provider_response',
      'pattern_generation',
      'verification',
      'operator_note'
    )),
  source_url text,
  evidence_text text not null default '',
  confidence numeric not null default 0
    check (confidence >= 0 and confidence <= 1),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists email_discovery_evidence_candidate_idx
  on growth.email_discovery_evidence (candidate_id);

drop trigger if exists trg_growth_email_discovery_runs_updated_at on growth.email_discovery_runs;
create trigger trg_growth_email_discovery_runs_updated_at
  before update on growth.email_discovery_runs
  for each row execute function public.set_updated_at();

drop trigger if exists trg_growth_email_discovery_candidates_updated_at on growth.email_discovery_candidates;
create trigger trg_growth_email_discovery_candidates_updated_at
  before update on growth.email_discovery_candidates
  for each row execute function public.set_updated_at();

revoke all on table growth.email_discovery_runs from public, anon, authenticated;
revoke all on table growth.email_discovery_candidates from public, anon, authenticated;
revoke all on table growth.email_discovery_evidence from public, anon, authenticated;

grant select, insert, update, delete on table growth.email_discovery_runs to service_role;
grant select, insert, update, delete on table growth.email_discovery_candidates to service_role;
grant select, insert, update, delete on table growth.email_discovery_evidence to service_role;

alter table growth.email_discovery_runs enable row level security;
alter table growth.email_discovery_candidates enable row level security;
alter table growth.email_discovery_evidence enable row level security;

comment on table growth.email_discovery_runs is
  'Phase 7.3A email discovery orchestration per canonical company + person.';
comment on table growth.email_discovery_candidates is
  'Evidence-backed email candidates before optional promotion to person_emails.';
comment on table growth.email_discovery_evidence is
  'Auditable evidence rows explaining why each email candidate exists.';
