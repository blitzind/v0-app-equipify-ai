-- Growth Engine — Verification + Enrichment (Prompt 28).
-- Evidence-backed only; raw_payload in metadata server-side.

do $$
begin
  if to_regclass('growth.contact_candidates') is null then
    raise exception 'Missing dependency: growth.contact_candidates';
  end if;
  if to_regclass('growth.external_company_candidates') is null then
    raise exception 'Missing dependency: growth.external_company_candidates';
  end if;
end;
$$;

create table if not exists growth.enrichment_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  contact_candidate_id uuid references growth.contact_candidates (id) on delete cascade,
  company_candidate_id uuid references growth.external_company_candidates (id) on delete cascade,
  created_by uuid,
  provider_names text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'partial', 'failed')),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists growth.contact_verifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  run_id uuid references growth.enrichment_runs (id) on delete set null,
  contact_candidate_id uuid not null references growth.contact_candidates (id) on delete cascade,
  provider_name text not null default '',
  provider_type text not null default ''
    check (provider_type in (
      'internal_growth',
      'manual_fixture',
      'future_hunter',
      'future_people_data_labs',
      'future_clearbit',
      'future_clay',
      'future_provider'
    )),
  email_status text not null default 'unverified'
    check (email_status in (
      'not_present', 'unverified', 'observed', 'insufficient_evidence', 'operator_verified', 'rejected'
    )),
  phone_status text not null default 'unverified'
    check (phone_status in (
      'not_present', 'unverified', 'observed', 'insufficient_evidence', 'operator_verified', 'rejected'
    )),
  linkedin_status text not null default 'unverified'
    check (linkedin_status in (
      'not_present', 'unverified', 'observed', 'insufficient_evidence', 'operator_verified', 'rejected'
    )),
  verification_confidence numeric not null default 0,
  verification_reason text not null default '',
  evidence jsonb not null default '[]'::jsonb,
  source_attribution jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  unique (contact_candidate_id, provider_name)
);

create table if not exists growth.company_enrichments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  run_id uuid references growth.enrichment_runs (id) on delete set null,
  company_candidate_id uuid not null references growth.external_company_candidates (id) on delete cascade,
  provider_name text not null default '',
  provider_type text not null default ''
    check (provider_type in (
      'internal_growth',
      'manual_fixture',
      'future_hunter',
      'future_people_data_labs',
      'future_clearbit',
      'future_clay',
      'future_provider'
    )),
  employee_estimate text,
  revenue_estimate text,
  industry text,
  subindustry text,
  technology_signals jsonb not null default '[]'::jsonb,
  crm_signals jsonb not null default '[]'::jsonb,
  service_signals jsonb not null default '[]'::jsonb,
  location_signals jsonb not null default '[]'::jsonb,
  confidence numeric not null default 0,
  evidence jsonb not null default '[]'::jsonb,
  source_attribution jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  unique (company_candidate_id, provider_name)
);

create index if not exists enrichment_runs_contact_idx
  on growth.enrichment_runs (contact_candidate_id, created_at desc);

create index if not exists enrichment_runs_company_idx
  on growth.enrichment_runs (company_candidate_id, created_at desc);

create index if not exists contact_verifications_contact_idx
  on growth.contact_verifications (contact_candidate_id, verification_confidence desc);

create index if not exists company_enrichments_company_idx
  on growth.company_enrichments (company_candidate_id, confidence desc);
