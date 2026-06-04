-- Growth Engine Phase 7.6A — Company intelligence foundation (canonical company scoped).

do $$
begin
  if to_regclass('growth.companies') is null then
    raise exception 'Missing dependency: growth.companies';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.company_intelligence_runs
-- -----------------------------------------------------------------------------

create table if not exists growth.company_intelligence_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  company_id uuid not null references growth.companies (id) on delete cascade,
  created_by uuid,

  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'partial', 'failed')),
  provider_summary text not null default '',
  started_at timestamptz,
  completed_at timestamptz,
  finding_count int not null default 0,
  verified_count int not null default 0,
  promoted_count int not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists company_intelligence_runs_company_idx
  on growth.company_intelligence_runs (company_id, created_at desc);

-- -----------------------------------------------------------------------------
-- growth.company_intelligence_evidence — auditable source observations per run
-- -----------------------------------------------------------------------------

create table if not exists growth.company_intelligence_evidence (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  run_id uuid not null references growth.company_intelligence_runs (id) on delete cascade,
  company_id uuid not null references growth.companies (id) on delete cascade,

  finding_ref uuid not null default gen_random_uuid(),
  intelligence_category text not null default ''
    check (intelligence_category in (
      'description',
      'industry',
      'sub_industry',
      'website_signal',
      'technology',
      'social_presence',
      'company_size',
      'location',
      'hiring',
      'contactability'
    )),
  intelligence_key text not null default '',

  evidence_type text not null default 'observation'
    check (evidence_type in (
      'website_page',
      'website_structured',
      'schema_org',
      'meta_tag',
      'staging_row',
      'canonical_field',
      'canonical_snapshot',
      'social_profile',
      'pattern_match',
      'verification',
      'operator_note'
    )),

  source_url text,
  source_record_id text,
  extraction_method text not null default '',
  evidence_text text not null default '',
  proposed_value_text text,
  proposed_value_json jsonb,
  confidence numeric not null default 0
    check (confidence >= 0 and confidence <= 1),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists company_intelligence_evidence_run_idx
  on growth.company_intelligence_evidence (run_id, finding_ref);

create index if not exists company_intelligence_evidence_company_idx
  on growth.company_intelligence_evidence (company_id, intelligence_category);

-- -----------------------------------------------------------------------------
-- growth.company_intelligence_snapshots — canonical evidence-backed intelligence store
-- -----------------------------------------------------------------------------

create table if not exists growth.company_intelligence_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  company_id uuid not null references growth.companies (id) on delete cascade,
  intelligence_category text not null default ''
    check (intelligence_category in (
      'description',
      'industry',
      'sub_industry',
      'website_signal',
      'technology',
      'social_presence',
      'company_size',
      'location',
      'hiring',
      'contactability'
    )),
  intelligence_key text not null default '',
  normalized_intelligence_key text not null default '',

  value_text text,
  value_json jsonb,
  confidence numeric not null default 0
    check (confidence >= 0 and confidence <= 1),
  verification_status text not null default 'observed'
    check (verification_status in (
      'unverified',
      'probable',
      'verified',
      'invalid',
      'superseded'
    )),

  source_table text not null default 'company_intelligence_runs',
  source_run_id uuid references growth.company_intelligence_runs (id) on delete set null,
  source_evidence_ids uuid[] not null default '{}',
  provider_name text not null default '',
  discovery_source text not null default '',
  observed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists company_intelligence_snapshots_company_normalized_key_unique
  on growth.company_intelligence_snapshots (company_id, normalized_intelligence_key)
  where normalized_intelligence_key <> '' and verification_status <> 'superseded';

create index if not exists company_intelligence_snapshots_company_idx
  on growth.company_intelligence_snapshots (company_id, intelligence_category);

drop trigger if exists trg_growth_company_intelligence_runs_updated_at on growth.company_intelligence_runs;
create trigger trg_growth_company_intelligence_runs_updated_at
  before update on growth.company_intelligence_runs
  for each row execute function public.set_updated_at();

drop trigger if exists trg_growth_company_intelligence_snapshots_updated_at on growth.company_intelligence_snapshots;
create trigger trg_growth_company_intelligence_snapshots_updated_at
  before update on growth.company_intelligence_snapshots
  for each row execute function public.set_updated_at();

revoke all on table growth.company_intelligence_runs from public, anon, authenticated;
revoke all on table growth.company_intelligence_evidence from public, anon, authenticated;
revoke all on table growth.company_intelligence_snapshots from public, anon, authenticated;

grant select, insert, update, delete on table growth.company_intelligence_runs to service_role;
grant select, insert, update, delete on table growth.company_intelligence_evidence to service_role;
grant select, insert, update, delete on table growth.company_intelligence_snapshots to service_role;

alter table growth.company_intelligence_runs enable row level security;
alter table growth.company_intelligence_evidence enable row level security;
alter table growth.company_intelligence_snapshots enable row level security;

comment on table growth.company_intelligence_runs is
  'Phase 7.6A company intelligence orchestration per canonical company (sync HTTP only in 7.6A).';
comment on table growth.company_intelligence_evidence is
  'Auditable evidence for each intelligence finding; every promoted snapshot must trace to evidence rows.';
comment on table growth.company_intelligence_snapshots is
  'Canonical evidence-backed company intelligence (no AI-generated firmographics).';
