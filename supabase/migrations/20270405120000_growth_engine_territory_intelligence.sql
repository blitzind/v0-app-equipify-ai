-- Growth Engine — Territory Intelligence + Opportunity Maps.

do $$
begin
  if to_regclass('growth.prospect_search_saved_searches') is null then
    raise exception 'Missing dependency: growth.prospect_search_saved_searches';
  end if;
end;
$$;

create table if not exists growth.territories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  territory_type text not null default 'custom'
    check (territory_type in ('state', 'city_metro', 'postal_code', 'radius', 'custom')),
  territory_filter jsonb not null default '{}'::jsonb,
  industry text,
  icp_label text,
  saved_search_id uuid references growth.prospect_search_saved_searches (id) on delete set null,
  query_text text not null default '',
  filters jsonb not null default '{}'::jsonb,
  created_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists growth.territory_companies (
  id uuid primary key default gen_random_uuid(),
  territory_id uuid not null references growth.territories (id) on delete cascade,
  company_id uuid not null,
  source_type text not null,
  company_name text not null default '',
  lat numeric,
  lng numeric,
  is_mapped boolean not null default false,
  match_reasons jsonb not null default '[]'::jsonb,
  lead_engine_score int,
  growth_signal_score int,
  contact_coverage_score int,
  score_bucket text not null default 'low'
    check (score_bucket in ('urgent', 'high', 'moderate', 'low', 'unmapped')),
  is_existing_customer boolean not null default false,
  is_existing_prospect boolean not null default false,
  is_suppressed boolean not null default false,
  last_matched_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (territory_id, company_id, source_type)
);

create table if not exists growth.territory_scores (
  territory_id uuid primary key references growth.territories (id) on delete cascade,
  company_count int not null default 0,
  mapped_company_count int not null default 0,
  unmapped_company_count int not null default 0,
  high_fit_count int not null default 0,
  contact_coverage_avg numeric not null default 0,
  growth_signal_avg numeric not null default 0,
  growth_signal_density numeric not null default 0,
  existing_customer_count int not null default 0,
  existing_prospect_count int not null default 0,
  suppressed_count int not null default 0,
  whitespace_score int not null default 0,
  territory_opportunity_score int not null default 0,
  score_buckets jsonb not null default '{}'::jsonb,
  clusters jsonb not null default '[]'::jsonb,
  whitespace_zones jsonb not null default '[]'::jsonb,
  top_signal_companies jsonb not null default '[]'::jsonb,
  last_computed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists growth.territory_refresh_queue (
  id uuid primary key default gen_random_uuid(),
  territory_id uuid not null references growth.territories (id) on delete cascade,
  reason text not null default 'stale',
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  scheduled_for timestamptz not null default now(),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (territory_id, reason)
);

create index if not exists territories_saved_search_idx
  on growth.territories (saved_search_id);

create index if not exists territory_companies_territory_idx
  on growth.territory_companies (territory_id, score_bucket);

create index if not exists territory_companies_mapped_idx
  on growth.territory_companies (territory_id, is_mapped)
  where is_mapped = true;

create index if not exists territory_refresh_queue_status_idx
  on growth.territory_refresh_queue (status, scheduled_for asc);

revoke all on table growth.territories from public, anon, authenticated;
revoke all on table growth.territory_companies from public, anon, authenticated;
revoke all on table growth.territory_scores from public, anon, authenticated;
revoke all on table growth.territory_refresh_queue from public, anon, authenticated;

grant select, insert, update, delete on table growth.territories to service_role;
grant select, insert, update, delete on table growth.territory_companies to service_role;
grant select, insert, update, delete on table growth.territory_scores to service_role;
grant select, insert, update, delete on table growth.territory_refresh_queue to service_role;

alter table growth.territories enable row level security;
alter table growth.territory_companies enable row level security;
alter table growth.territory_scores enable row level security;
alter table growth.territory_refresh_queue enable row level security;
