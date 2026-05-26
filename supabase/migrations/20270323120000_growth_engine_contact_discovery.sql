-- Growth Engine — Contact Discovery + Buying Committee (Prompt 27).
-- Infrastructure only — no auto Lead Inbox, no guessed emails.

do $$
begin
  if to_regclass('growth.external_company_candidates') is null then
    raise exception 'Missing dependency: growth.external_company_candidates';
  end if;
end;
$$;

create table if not exists growth.contact_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  company_candidate_id uuid not null references growth.external_company_candidates (id) on delete cascade,
  created_by uuid,
  provider_names text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'partial', 'failed')),
  candidate_count int not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists growth.contact_candidates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  run_id uuid references growth.contact_discovery_runs (id) on delete set null,
  company_candidate_id uuid not null references growth.external_company_candidates (id) on delete cascade,
  provider_name text not null default '',
  provider_type text not null default ''
    check (provider_type in (
      'manual_fixture',
      'internal_growth',
      'future_apollo',
      'future_seamless',
      'future_people_data_labs',
      'future_clay',
      'future_provider'
    )),
  full_name text not null default '',
  first_name text,
  last_name text,
  job_title text,
  department text,
  seniority text,
  linkedin_url text,
  email text,
  phone text,
  verification_state text not null default 'unverified'
    check (verification_state in (
      'unverified',
      'operator_verified',
      'rejected',
      'insufficient_evidence'
    )),
  confidence numeric not null default 0,
  source_attribution jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  dedupe_hash text not null default '',
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists growth.buying_committees (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  company_id uuid not null,
  committee_type text not null default 'initial'
    check (committee_type in ('initial', 'expansion', 'evaluation')),
  coverage_score numeric not null default 0,
  decision_maker_found boolean not null default false,
  economic_buyer_found boolean not null default false,
  technical_buyer_found boolean not null default false,
  champion_found boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists growth.buying_committee_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  committee_id uuid not null references growth.buying_committees (id) on delete cascade,
  contact_candidate_id uuid not null references growth.contact_candidates (id) on delete cascade,
  committee_role text not null
    check (committee_role in (
      'economic_buyer',
      'decision_maker',
      'technical_buyer',
      'champion',
      'operator',
      'owner'
    )),
  confidence numeric not null default 0,
  unique (committee_id, contact_candidate_id)
);

create index if not exists contact_discovery_runs_company_idx
  on growth.contact_discovery_runs (company_candidate_id, created_at desc);

create index if not exists contact_candidates_company_idx
  on growth.contact_candidates (company_candidate_id, confidence desc);

create index if not exists contact_candidates_dedupe_idx
  on growth.contact_candidates (company_candidate_id, dedupe_hash);

create index if not exists buying_committees_company_idx
  on growth.buying_committees (company_id, created_at desc);

create index if not exists buying_committee_members_committee_idx
  on growth.buying_committee_members (committee_id);
