-- Growth Engine Phase 7.5A — Social profile discovery (canonical company + person scoped).

do $$
begin
  if to_regclass('growth.companies') is null then
    raise exception 'Missing dependency: growth.companies';
  end if;
  if to_regclass('growth.persons') is null then
    raise exception 'Missing dependency: growth.persons';
  end if;
  if to_regclass('growth.person_profiles') is null then
    raise exception 'Missing dependency: growth.person_profiles';
  end if;
end;
$$;

-- Extend person_profiles for discovery promotion + expanded profile types.
alter table growth.person_profiles drop constraint if exists person_profiles_profile_type_check;
alter table growth.person_profiles add constraint person_profiles_profile_type_check
  check (profile_type in (
    'linkedin',
    'linkedin_person',
    'twitter',
    'facebook',
    'instagram',
    'github',
    'other'
  ));

alter table growth.person_profiles add column if not exists verification_status text not null default 'observed';
alter table growth.person_profiles drop constraint if exists person_profiles_verification_status_check;
alter table growth.person_profiles add constraint person_profiles_verification_status_check
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
-- growth.company_profiles — canonical company social pages (e.g. LinkedIn company)
-- -----------------------------------------------------------------------------

create table if not exists growth.company_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  company_id uuid not null references growth.companies (id) on delete cascade,
  profile_type text not null default 'linkedin_company'
    check (profile_type in (
      'linkedin_company',
      'twitter',
      'facebook',
      'instagram'
    )),
  profile_url text not null default '',
  normalized_profile_key text not null default '',
  confidence numeric not null default 0
    check (confidence >= 0 and confidence <= 1),

  verification_status text not null default 'observed'
    check (verification_status in (
      'not_present',
      'unverified',
      'observed',
      'insufficient_evidence',
      'operator_verified',
      'verified',
      'rejected'
    )),

  source_table text,
  source_id text,
  provider_name text not null default '',
  discovery_source text not null default '',
  observed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists company_profiles_normalized_key_unique
  on growth.company_profiles (normalized_profile_key)
  where normalized_profile_key <> '';

create index if not exists company_profiles_company_idx
  on growth.company_profiles (company_id);

-- -----------------------------------------------------------------------------
-- growth.social_profile_discovery_runs
-- -----------------------------------------------------------------------------

create table if not exists growth.social_profile_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  company_id uuid not null references growth.companies (id) on delete cascade,
  person_id uuid references growth.persons (id) on delete cascade,
  created_by uuid,

  discovery_scope text not null default 'person'
    check (discovery_scope in ('person', 'company')),

  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'partial', 'failed')),
  provider_summary text not null default '',
  started_at timestamptz,
  completed_at timestamptz,
  candidate_count int not null default 0,
  verified_count int not null default 0,
  promoted_count int not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,

  check (
    (discovery_scope = 'person' and person_id is not null)
    or (discovery_scope = 'company' and person_id is null)
  )
);

create index if not exists social_profile_discovery_runs_person_idx
  on growth.social_profile_discovery_runs (person_id, created_at desc)
  where person_id is not null;

create index if not exists social_profile_discovery_runs_company_idx
  on growth.social_profile_discovery_runs (company_id, created_at desc);

-- -----------------------------------------------------------------------------
-- growth.social_profile_discovery_candidates
-- -----------------------------------------------------------------------------

create table if not exists growth.social_profile_discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  run_id uuid not null references growth.social_profile_discovery_runs (id) on delete cascade,
  company_id uuid not null references growth.companies (id) on delete cascade,
  person_id uuid references growth.persons (id) on delete cascade,

  profile_type text not null default 'linkedin_person'
    check (profile_type in (
      'linkedin_person',
      'linkedin_company',
      'twitter',
      'facebook',
      'instagram'
    )),
  profile_url text not null default '',
  normalized_profile_key text not null default '',

  source text not null default 'unknown'
    check (source in (
      'website',
      'staging_contact',
      'canonical_channel',
      'manual',
      'unknown'
    )),
  confidence numeric not null default 0
    check (confidence >= 0 and confidence <= 1),
  confidence_tier text not null default 'low'
    check (confidence_tier in (
      'direct_evidence',
      'provider_evidence',
      'low'
    )),

  verification_status text not null default 'unverified'
    check (verification_status in (
      'unverified',
      'probable',
      'verified',
      'invalid'
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

  unique (run_id, normalized_profile_key)
);

create index if not exists social_profile_discovery_candidates_person_idx
  on growth.social_profile_discovery_candidates (person_id, confidence desc)
  where person_id is not null;

create index if not exists social_profile_discovery_candidates_company_idx
  on growth.social_profile_discovery_candidates (company_id, confidence desc);

create index if not exists social_profile_discovery_candidates_normalized_key_idx
  on growth.social_profile_discovery_candidates (normalized_profile_key);

-- -----------------------------------------------------------------------------
-- growth.social_profile_discovery_evidence
-- -----------------------------------------------------------------------------

create table if not exists growth.social_profile_discovery_evidence (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  candidate_id uuid not null references growth.social_profile_discovery_candidates (id) on delete cascade,

  evidence_type text not null default 'unknown'
    check (evidence_type in (
      'website_page',
      'website_structured',
      'social_link',
      'staging_row',
      'canonical_channel',
      'verification',
      'operator_note'
    )),
  source_url text,
  source_record_id text,
  extraction_method text,
  evidence_text text not null default '',
  confidence numeric not null default 0
    check (confidence >= 0 and confidence <= 1),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists social_profile_discovery_evidence_candidate_idx
  on growth.social_profile_discovery_evidence (candidate_id);

drop trigger if exists trg_growth_company_profiles_updated_at on growth.company_profiles;
create trigger trg_growth_company_profiles_updated_at
  before update on growth.company_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_growth_social_profile_discovery_runs_updated_at on growth.social_profile_discovery_runs;
create trigger trg_growth_social_profile_discovery_runs_updated_at
  before update on growth.social_profile_discovery_runs
  for each row execute function public.set_updated_at();

drop trigger if exists trg_growth_social_profile_discovery_candidates_updated_at on growth.social_profile_discovery_candidates;
create trigger trg_growth_social_profile_discovery_candidates_updated_at
  before update on growth.social_profile_discovery_candidates
  for each row execute function public.set_updated_at();

revoke all on table growth.company_profiles from public, anon, authenticated;
revoke all on table growth.social_profile_discovery_runs from public, anon, authenticated;
revoke all on table growth.social_profile_discovery_candidates from public, anon, authenticated;
revoke all on table growth.social_profile_discovery_evidence from public, anon, authenticated;

grant select, insert, update, delete on table growth.company_profiles to service_role;
grant select, insert, update, delete on table growth.social_profile_discovery_runs to service_role;
grant select, insert, update, delete on table growth.social_profile_discovery_candidates to service_role;
grant select, insert, update, delete on table growth.social_profile_discovery_evidence to service_role;

alter table growth.company_profiles enable row level security;
alter table growth.social_profile_discovery_runs enable row level security;
alter table growth.social_profile_discovery_candidates enable row level security;
alter table growth.social_profile_discovery_evidence enable row level security;

comment on table growth.company_profiles is
  'Canonical company-scoped social profile URLs (7.5A).';
comment on table growth.social_profile_discovery_runs is
  'Person or company scoped social profile discovery runs (7.5A foundation).';
comment on table growth.social_profile_discovery_candidates is
  'Evidence-backed social profile URL candidates per run.';
comment on table growth.social_profile_discovery_evidence is
  'Audit evidence rows explaining why a social profile candidate belongs to the subject.';
