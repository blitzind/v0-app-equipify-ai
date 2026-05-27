-- Growth Engine — Market Graph + Continuous Discovery + Confidence Intelligence.

do $$
begin
  if to_regclass('growth.real_world_discovery_runs') is null then
    raise exception 'Missing dependency: growth.real_world_discovery_runs';
  end if;
end;
$$;

create table if not exists growth.discovery_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null default 'continuous'
    check (run_type in ('continuous', 'segment', 'territory', 'manual')),
  segment_key text,
  discovery_source_type text not null
    check (discovery_source_type in (
      'google_business',
      'website_discovery',
      'territory_expansion',
      'industry_expansion',
      'referral_graph',
      'related_company',
      'public_company_source',
      'manual_seed'
    )),
  query_text text not null default '',
  industry text,
  territory_id uuid,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'partial', 'failed')),
  new_companies_found int not null default 0,
  duplicates_skipped int not null default 0,
  high_fit_found int not null default 0,
  territory_matches int not null default 0,
  signal_matches int not null default 0,
  error_message text,
  evidence jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists growth.discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references growth.discovery_runs (id) on delete cascade,
  company_id uuid not null,
  source_type text not null default 'external_discovered',
  company_name text not null default '',
  website text,
  domain text,
  industry text,
  location text,
  city text,
  state text,
  discovery_source_type text not null,
  source_confidence numeric not null default 0,
  evidence jsonb not null default '[]'::jsonb,
  reason_discovered text not null default '',
  dedupe_hash text not null default '',
  is_suppressed boolean not null default false,
  is_duplicate boolean not null default false,
  high_fit boolean not null default false,
  territory_match boolean not null default false,
  signal_match boolean not null default false,
  discovered_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dedupe_hash)
);

create table if not exists growth.discovery_sources (
  id uuid primary key default gen_random_uuid(),
  source_type text not null unique,
  label text not null default '',
  description text not null default '',
  is_live boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists growth.discovery_statistics (
  id uuid primary key default gen_random_uuid(),
  stat_date date not null default current_date,
  segment_key text not null default 'all',
  discovery_source_type text not null default 'industry_expansion',
  runs_completed int not null default 0,
  new_companies_found int not null default 0,
  duplicates_skipped int not null default 0,
  high_fit_found int not null default 0,
  territory_matches int not null default 0,
  signal_matches int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (stat_date, segment_key, discovery_source_type)
);

create table if not exists growth.discovery_refresh_queue (
  id uuid primary key default gen_random_uuid(),
  segment_key text not null,
  reason text not null default 'nightly',
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  scheduled_for timestamptz not null default now(),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (segment_key, reason)
);

create table if not exists growth.company_relationships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  related_company_id uuid not null,
  relationship_type text not null
    check (relationship_type in (
      'same_market',
      'same_geo',
      'similar_icp',
      'shared_technology',
      'shared_signal_patterns',
      'similar_size',
      'same_industry',
      'competitive_overlap'
    )),
  relationship_strength int not null default 0
    check (relationship_strength >= 0 and relationship_strength <= 100),
  evidence_excerpt text not null default '',
  source_type text not null default 'market_graph',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, related_company_id, relationship_type)
);

create table if not exists growth.market_coverage_scores (
  market_key text primary key,
  market_label text not null default '',
  territory_id uuid,
  industry text,
  market_total_discovered int not null default 0,
  market_researched int not null default 0,
  market_contacted int not null default 0,
  market_active_pipeline int not null default 0,
  market_customers int not null default 0,
  market_penetration_percent numeric not null default 0,
  market_signal_density numeric not null default 0,
  market_contact_coverage numeric not null default 0,
  whitespace_score int not null default 0,
  coverage_score int not null default 0,
  penetration_score int not null default 0,
  territory_strength int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  last_computed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists growth.company_confidence_scores (
  company_id uuid primary key,
  discovery_confidence int not null default 0,
  contact_confidence int not null default 0,
  signal_confidence int not null default 0,
  coverage_confidence int not null default 0,
  freshness_confidence int not null default 0,
  overall_confidence int not null default 0,
  evidence jsonb not null default '[]'::jsonb,
  last_computed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists growth.discovery_outcome_patterns (
  id uuid primary key default gen_random_uuid(),
  pattern_key text not null unique,
  industry text,
  employee_band text,
  technology text,
  won_count int not null default 0,
  lost_count int not null default 0,
  meetings_booked int not null default 0,
  positive_replies int not null default 0,
  negative_replies int not null default 0,
  closed_deals int not null default 0,
  discovery_priority_boost int not null default 0,
  evidence_excerpt text not null default '',
  last_computed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists growth.market_health_refresh_queue (
  id uuid primary key default gen_random_uuid(),
  market_key text not null,
  reason text not null default 'stale',
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  scheduled_for timestamptz not null default now(),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (market_key, reason)
);

insert into growth.discovery_sources (source_type, label, description, is_live)
values
  ('google_business', 'Google Business', 'Live business directory discovery', true),
  ('website_discovery', 'Website discovery', 'Website crawl evidence', false),
  ('territory_expansion', 'Territory expansion', 'Territory-based net-new discovery', false),
  ('industry_expansion', 'Industry expansion', 'Industry segment discovery runs', false),
  ('referral_graph', 'Referral graph', 'Related company graph expansion', false),
  ('related_company', 'Related company', 'Similar company relationship expansion', false),
  ('public_company_source', 'Public company source', 'Public registry evidence', false),
  ('manual_seed', 'Manual seed', 'Operator-initiated seed list', false)
on conflict (source_type) do nothing;

create index if not exists discovery_runs_status_idx on growth.discovery_runs (status, created_at desc);
create index if not exists discovery_candidates_run_idx on growth.discovery_candidates (run_id, discovered_at desc);
create index if not exists discovery_candidates_company_idx on growth.discovery_candidates (company_id);
create index if not exists company_relationships_company_idx on growth.company_relationships (company_id, relationship_strength desc);
create index if not exists discovery_refresh_queue_status_idx on growth.discovery_refresh_queue (status, scheduled_for asc);
create index if not exists market_health_refresh_queue_status_idx on growth.market_health_refresh_queue (status, scheduled_for asc);

revoke all on table growth.discovery_runs from public, anon, authenticated;
revoke all on table growth.discovery_candidates from public, anon, authenticated;
revoke all on table growth.discovery_sources from public, anon, authenticated;
revoke all on table growth.discovery_statistics from public, anon, authenticated;
revoke all on table growth.discovery_refresh_queue from public, anon, authenticated;
revoke all on table growth.company_relationships from public, anon, authenticated;
revoke all on table growth.market_coverage_scores from public, anon, authenticated;
revoke all on table growth.company_confidence_scores from public, anon, authenticated;
revoke all on table growth.discovery_outcome_patterns from public, anon, authenticated;
revoke all on table growth.market_health_refresh_queue from public, anon, authenticated;

grant select, insert, update, delete on table growth.discovery_runs to service_role;
grant select, insert, update, delete on table growth.discovery_candidates to service_role;
grant select, insert, update, delete on table growth.discovery_sources to service_role;
grant select, insert, update, delete on table growth.discovery_statistics to service_role;
grant select, insert, update, delete on table growth.discovery_refresh_queue to service_role;
grant select, insert, update, delete on table growth.company_relationships to service_role;
grant select, insert, update, delete on table growth.market_coverage_scores to service_role;
grant select, insert, update, delete on table growth.company_confidence_scores to service_role;
grant select, insert, update, delete on table growth.discovery_outcome_patterns to service_role;
grant select, insert, update, delete on table growth.market_health_refresh_queue to service_role;

alter table growth.discovery_runs enable row level security;
alter table growth.discovery_candidates enable row level security;
alter table growth.discovery_sources enable row level security;
alter table growth.discovery_statistics enable row level security;
alter table growth.discovery_refresh_queue enable row level security;
alter table growth.company_relationships enable row level security;
alter table growth.market_coverage_scores enable row level security;
alter table growth.company_confidence_scores enable row level security;
alter table growth.discovery_outcome_patterns enable row level security;
alter table growth.market_health_refresh_queue enable row level security;
