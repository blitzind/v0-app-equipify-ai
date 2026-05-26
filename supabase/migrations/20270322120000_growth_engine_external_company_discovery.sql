-- Growth Engine — External Company Discovery (Prompt 26).
-- Provider runs + candidates. No autonomous leads; raw_payload server-side only.

do $$
begin
  if to_regclass('growth.lead_inbox') is null then
    raise exception 'Missing dependency: growth.lead_inbox';
  end if;
end;
$$;

create table if not exists growth.external_company_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  query text not null default '',
  industry text,
  location text,
  provider_names text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'partial', 'failed')),
  candidate_count int not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists growth.external_company_candidates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  run_id uuid not null references growth.external_company_discovery_runs (id) on delete cascade,
  provider_name text not null default '',
  provider_type text not null default ''
    check (provider_type in (
      'google_places',
      'serp',
      'manual_import',
      'future_apollo',
      'future_seamless',
      'future_clay',
      'future_people_data_labs'
    )),
  query text not null default '',
  industry text,
  location text,
  company_name text not null default '',
  website text,
  domain text,
  phone text,
  address text,
  city text,
  state text,
  country text,
  category text,
  rating numeric,
  review_count int,
  source_url text,
  confidence numeric not null default 0,
  dedupe_hash text not null default '',
  existing_customer_match boolean not null default false,
  existing_prospect_match boolean not null default false,
  existing_growth_lead_match boolean not null default false,
  evidence jsonb not null default '[]'::jsonb,
  source_attribution jsonb not null default '[]'::jsonb,
  raw_payload jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists external_company_discovery_runs_created_idx
  on growth.external_company_discovery_runs (created_at desc);

create index if not exists external_company_candidates_run_idx
  on growth.external_company_candidates (run_id, created_at desc);

create index if not exists external_company_candidates_dedupe_idx
  on growth.external_company_candidates (dedupe_hash);

create index if not exists external_company_candidates_domain_idx
  on growth.external_company_candidates (domain)
  where domain is not null and domain <> '';

-- Prospect Search list members: allow external_discovered source type.
alter table growth.prospect_search_list_members
  drop constraint if exists prospect_search_list_members_source_type_check;

alter table growth.prospect_search_list_members
  add constraint prospect_search_list_members_source_type_check
  check (source_type in (
    'growth_lead',
    'lead_inbox',
    'crm_prospect',
    'crm_customer',
    'person',
    'external_discovered'
  ));
