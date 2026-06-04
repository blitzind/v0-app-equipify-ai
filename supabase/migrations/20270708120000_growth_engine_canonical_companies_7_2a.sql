-- Growth Engine Phase 7.2A — Canonical company layer (additive, growth schema only).

do $$
begin
  if to_regclass('growth.external_company_candidates') is null then
    raise exception 'Missing dependency: growth.external_company_candidates';
  end if;
  if to_regclass('growth.real_world_company_candidates') is null then
    raise exception 'Missing dependency: growth.real_world_company_candidates';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.companies — canonical company system of record
-- -----------------------------------------------------------------------------

create table if not exists growth.companies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  display_name text not null default '',
  normalized_name text not null default '',
  legal_name text,

  primary_domain text,
  website text,
  phone text,
  address_line1 text,
  city text,
  state text,
  postal_code text,
  country text,
  latitude numeric,
  longitude numeric,

  industry text,
  subindustry text,
  employee_range text,
  revenue_range text,
  technologies jsonb not null default '[]'::jsonb,

  identity_confidence numeric not null default 0
    check (identity_confidence >= 0 and identity_confidence <= 1),
  resolution_method text not null default 'new'
    check (resolution_method in (
      'normalized_domain',
      'domain_alias',
      'name_city',
      'name_state',
      'new',
      'manual'
    )),

  status text not null default 'active'
    check (status in ('active', 'merged', 'suppressed')),
  merged_into_company_id uuid references growth.companies (id) on delete set null,

  first_observed_at timestamptz not null default now(),
  last_observed_at timestamptz not null default now(),
  last_refreshed_at timestamptz,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists companies_normalized_name_idx
  on growth.companies (normalized_name)
  where status = 'active';

create index if not exists companies_primary_domain_idx
  on growth.companies (primary_domain)
  where status = 'active' and primary_domain is not null;

create index if not exists companies_status_idx
  on growth.companies (status, updated_at desc);

create index if not exists companies_merged_into_idx
  on growth.companies (merged_into_company_id)
  where merged_into_company_id is not null;

-- -----------------------------------------------------------------------------
-- growth.company_domains — normalized + exact domain aliases
-- -----------------------------------------------------------------------------

create table if not exists growth.company_domains (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references growth.companies (id) on delete cascade,
  created_at timestamptz not null default now(),

  domain text not null default '',
  normalized_domain text not null default '',
  is_primary boolean not null default false,
  source_table text,
  source_id text,
  observed_at timestamptz not null default now(),

  unique (normalized_domain)
);

create index if not exists company_domains_company_idx
  on growth.company_domains (company_id);

create index if not exists company_domains_exact_domain_idx
  on growth.company_domains (lower(domain));

-- -----------------------------------------------------------------------------
-- growth.company_source_lineage — staging → canonical attribution
-- -----------------------------------------------------------------------------

create table if not exists growth.company_source_lineage (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references growth.companies (id) on delete cascade,
  created_at timestamptz not null default now(),

  source_table text not null,
  source_id uuid not null,
  provider_name text not null default '',
  provider_type text not null default '',
  run_id uuid,
  confidence numeric not null default 0,
  observed_at timestamptz not null default now(),
  source_metadata jsonb not null default '{}'::jsonb,

  unique (source_table, source_id)
);

create index if not exists company_source_lineage_company_idx
  on growth.company_source_lineage (company_id, observed_at desc);

-- -----------------------------------------------------------------------------
-- growth.company_merge_events — survivor lineage when companies merge
-- -----------------------------------------------------------------------------

create table if not exists growth.company_merge_events (
  id uuid primary key default gen_random_uuid(),
  survivor_company_id uuid not null references growth.companies (id) on delete cascade,
  merged_company_id uuid not null references growth.companies (id) on delete cascade,
  merge_reason text not null default '',
  resolution_method text not null default 'normalized_domain',
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),

  unique (survivor_company_id, merged_company_id)
);

-- -----------------------------------------------------------------------------
-- Staging linkage (nullable, backward compatible)
-- -----------------------------------------------------------------------------

alter table growth.external_company_candidates
  add column if not exists canonical_company_id uuid references growth.companies (id) on delete set null;

alter table growth.real_world_company_candidates
  add column if not exists canonical_company_id uuid references growth.companies (id) on delete set null;

alter table growth.discovery_candidates
  add column if not exists canonical_company_id uuid references growth.companies (id) on delete set null;

alter table growth.company_contacts
  add column if not exists canonical_company_id uuid references growth.companies (id) on delete set null;

create index if not exists external_company_candidates_canonical_idx
  on growth.external_company_candidates (canonical_company_id)
  where canonical_company_id is not null;

create index if not exists real_world_company_candidates_canonical_idx
  on growth.real_world_company_candidates (canonical_company_id)
  where canonical_company_id is not null;

create index if not exists discovery_candidates_canonical_idx
  on growth.discovery_candidates (canonical_company_id)
  where canonical_company_id is not null;

create index if not exists company_contacts_canonical_company_idx
  on growth.company_contacts (canonical_company_id)
  where canonical_company_id is not null;

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------

drop trigger if exists trg_growth_companies_updated_at on growth.companies;
create trigger trg_growth_companies_updated_at
  before update on growth.companies
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- service_role access (Growth Engine platform only)
-- -----------------------------------------------------------------------------

revoke all on table growth.companies from public, anon, authenticated;
revoke all on table growth.company_domains from public, anon, authenticated;
revoke all on table growth.company_source_lineage from public, anon, authenticated;
revoke all on table growth.company_merge_events from public, anon, authenticated;

grant select, insert, update, delete on table growth.companies to service_role;
grant select, insert, update, delete on table growth.company_domains to service_role;
grant select, insert, update, delete on table growth.company_source_lineage to service_role;
grant select, insert, update, delete on table growth.company_merge_events to service_role;

alter table growth.companies enable row level security;
alter table growth.company_domains enable row level security;
alter table growth.company_source_lineage enable row level security;
alter table growth.company_merge_events enable row level security;

comment on table growth.companies is
  'Phase 7.2A canonical company system of record for Growth Engine contact graph.';
comment on table growth.company_domains is
  'Domain aliases for canonical companies; normalized_domain is globally unique.';
comment on table growth.company_source_lineage is
  'Maps staging ingestion rows to canonical companies with provider attribution.';
