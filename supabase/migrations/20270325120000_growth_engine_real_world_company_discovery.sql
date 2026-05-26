-- Growth Engine — Real-World Company Discovery (Prompt 29).
-- Public-source company discovery. No Apollo/Seamless/Clay/PDL. Raw payload server-side only.

do $$
begin
  if to_regclass('growth.lead_inbox') is null then
    raise exception 'Missing dependency: growth.lead_inbox';
  end if;
end;
$$;

create table if not exists growth.real_world_discovery_runs (
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

create table if not exists growth.real_world_company_candidates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  run_id uuid not null references growth.real_world_discovery_runs (id) on delete cascade,
  query text not null default '',
  industry text,
  location text,
  provider_name text not null default '',
  provider_type text not null default ''
    check (provider_type in (
      'google_places',
      'serp',
      'business_directory',
      'manual_import',
      'fixture'
    )),
  company_name text not null default '',
  website text,
  domain text,
  phone text,
  address text,
  city text,
  state text,
  country text,
  category text,
  description text,
  rating numeric,
  review_count int,
  source_url text,
  source_rank int,
  confidence numeric not null default 0,
  evidence jsonb not null default '[]'::jsonb,
  source_attribution jsonb not null default '[]'::jsonb,
  dedupe_hash text not null default '',
  existing_customer_match boolean not null default false,
  existing_prospect_match boolean not null default false,
  existing_growth_lead_match boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  raw_payload_server_only jsonb
);

create index if not exists real_world_discovery_runs_created_idx
  on growth.real_world_discovery_runs (created_at desc);

create index if not exists real_world_company_candidates_run_idx
  on growth.real_world_company_candidates (run_id, created_at desc);

create index if not exists real_world_company_candidates_dedupe_idx
  on growth.real_world_company_candidates (dedupe_hash);

create index if not exists real_world_company_candidates_domain_idx
  on growth.real_world_company_candidates (domain)
  where domain is not null and domain <> '';

-- Contact + enrichment: allow company_candidate_id to reference real-world rows (no Apollo/PDL FK).
alter table growth.contact_discovery_runs
  drop constraint if exists contact_discovery_runs_company_candidate_id_fkey;

alter table growth.contact_candidates
  drop constraint if exists contact_candidates_company_candidate_id_fkey;

alter table growth.enrichment_runs
  drop constraint if exists enrichment_runs_company_candidate_id_fkey;

alter table growth.company_enrichments
  drop constraint if exists company_enrichments_company_candidate_id_fkey;

revoke all on table growth.real_world_discovery_runs from public, anon, authenticated;
revoke all on table growth.real_world_company_candidates from public, anon, authenticated;
