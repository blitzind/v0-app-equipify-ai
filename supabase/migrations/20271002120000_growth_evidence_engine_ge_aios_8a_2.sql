-- GE-AIOS-8A-2 — Evidence Engine persistence (organization-scoped, run-scoped).

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.evidence_engine_runs
-- -----------------------------------------------------------------------------

create table if not exists growth.evidence_engine_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  organization_id uuid not null references public.organizations (id) on delete cascade,
  trigger text not null default 'initial'
    check (trigger in ('initial', 'scheduled_refresh', 'operator_request', 'profile_approved')),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'partial', 'failed', 'cached')),
  input_hash text not null default '',
  extraction_version text not null default 'ge-aios-8a-2-v1',
  website_url text,
  providers text[] not null default '{}',
  started_at timestamptz,
  completed_at timestamptz,
  evidence_count int not null default 0,
  fact_count int not null default 0,
  contradiction_count int not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  diagnostics jsonb not null default '{}'::jsonb,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists evidence_engine_runs_org_created_idx
  on growth.evidence_engine_runs (organization_id, created_at desc);

create index if not exists evidence_engine_runs_org_input_hash_idx
  on growth.evidence_engine_runs (organization_id, input_hash, status, completed_at desc);

-- -----------------------------------------------------------------------------
-- growth.evidence_engine_evidence
-- -----------------------------------------------------------------------------

create table if not exists growth.evidence_engine_evidence (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  run_id uuid not null references growth.evidence_engine_runs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  evidence_id uuid not null,

  provider text not null default 'website'
    check (provider in (
      'website',
      'structured_website',
      'approved_profile',
      'crm',
      'knowledge_center',
      'operator_input',
      'ai_inference',
      'fallback'
    )),
  decision_tier text not null default 'explicit_website'
    check (decision_tier in (
      'explicit_website',
      'structured_extraction',
      'historical_customer',
      'ai_reasoning',
      'fallback_assumption'
    )),
  lifecycle_status text not null default 'active'
    check (lifecycle_status in ('active', 'needs_review', 'contradicted', 'deprecated', 'expired')),
  evidence_type text not null default 'website_page'
    check (evidence_type in (
      'website_page',
      'website_structured',
      'schema_org',
      'meta_tag',
      'pattern_match',
      'crm_record',
      'operator_input',
      'approved_profile',
      'knowledge_document',
      'ai_inference',
      'fallback_assumption'
    )),

  value_text text,
  value_json jsonb,
  source_url text,
  page_title text,
  raw_excerpt text,
  confidence jsonb not null default '{}'::jsonb,
  extracted_at timestamptz not null default now(),
  verified_at timestamptz,
  expires_at timestamptz,
  source_lineage jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,

  unique (run_id, evidence_id)
);

create index if not exists evidence_engine_evidence_run_idx
  on growth.evidence_engine_evidence (run_id, evidence_id);

create index if not exists evidence_engine_evidence_org_idx
  on growth.evidence_engine_evidence (organization_id, provider, extracted_at desc);

-- -----------------------------------------------------------------------------
-- growth.evidence_engine_facts
-- -----------------------------------------------------------------------------

create table if not exists growth.evidence_engine_facts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  run_id uuid not null references growth.evidence_engine_runs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  fact_id uuid not null,

  fact_key text not null default '',
  category text not null default 'company'
    check (category in (
      'company',
      'ideal_customers',
      'problems',
      'sales_marketing',
      'operations',
      'strategy',
      'support',
      'terminology'
    )),
  value_text text,
  value_json jsonb,
  lifecycle_status text not null default 'active'
    check (lifecycle_status in ('active', 'needs_review', 'contradicted', 'deprecated', 'expired')),
  confidence jsonb not null default '{}'::jsonb,
  supporting_evidence_ids uuid[] not null default '{}',
  contradicting_evidence_ids uuid[] not null default '{}',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_verified_at timestamptz,
  deprecated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,

  unique (run_id, fact_id)
);

create index if not exists evidence_engine_facts_run_idx
  on growth.evidence_engine_facts (run_id, fact_key);

create index if not exists evidence_engine_facts_org_fact_key_idx
  on growth.evidence_engine_facts (organization_id, fact_key, last_seen_at desc);

-- -----------------------------------------------------------------------------
-- growth.evidence_engine_contradictions
-- -----------------------------------------------------------------------------

create table if not exists growth.evidence_engine_contradictions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  run_id uuid not null references growth.evidence_engine_runs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  contradiction_id uuid not null,

  fact_key text not null default '',
  conflicting_values jsonb not null default '[]'::jsonb,
  evidence_ids uuid[] not null default '{}',
  severity text not null default 'low'
    check (severity in ('low', 'medium', 'high')),
  recommended_resolution text not null default '',
  requires_human_review boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,

  unique (run_id, contradiction_id)
);

create index if not exists evidence_engine_contradictions_run_idx
  on growth.evidence_engine_contradictions (run_id, fact_key);

-- -----------------------------------------------------------------------------
-- growth.evidence_engine_snapshots — Ava's current org understanding at a point in time
-- -----------------------------------------------------------------------------

create table if not exists growth.evidence_engine_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  organization_id uuid not null references public.organizations (id) on delete cascade,
  run_id uuid not null references growth.evidence_engine_runs (id) on delete cascade,
  generated_at timestamptz not null default now(),
  input_hash text not null default '',
  is_current boolean not null default true,
  source_providers text[] not null default '{}',
  snapshot_json jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists evidence_engine_snapshots_org_generated_idx
  on growth.evidence_engine_snapshots (organization_id, generated_at desc);

create unique index if not exists evidence_engine_snapshots_org_current_unique
  on growth.evidence_engine_snapshots (organization_id)
  where is_current = true;

drop trigger if exists trg_growth_evidence_engine_runs_updated_at on growth.evidence_engine_runs;
create trigger trg_growth_evidence_engine_runs_updated_at
  before update on growth.evidence_engine_runs
  for each row execute function public.set_updated_at();

drop trigger if exists trg_growth_evidence_engine_snapshots_updated_at on growth.evidence_engine_snapshots;
create trigger trg_growth_evidence_engine_snapshots_updated_at
  before update on growth.evidence_engine_snapshots
  for each row execute function public.set_updated_at();

revoke all on table growth.evidence_engine_runs from public, anon, authenticated;
revoke all on table growth.evidence_engine_evidence from public, anon, authenticated;
revoke all on table growth.evidence_engine_facts from public, anon, authenticated;
revoke all on table growth.evidence_engine_contradictions from public, anon, authenticated;
revoke all on table growth.evidence_engine_snapshots from public, anon, authenticated;

grant select, insert, update, delete on table growth.evidence_engine_runs to service_role;
grant select, insert, update, delete on table growth.evidence_engine_evidence to service_role;
grant select, insert, update, delete on table growth.evidence_engine_facts to service_role;
grant select, insert, update, delete on table growth.evidence_engine_contradictions to service_role;
grant select, insert, update, delete on table growth.evidence_engine_snapshots to service_role;

alter table growth.evidence_engine_runs enable row level security;
alter table growth.evidence_engine_evidence enable row level security;
alter table growth.evidence_engine_facts enable row level security;
alter table growth.evidence_engine_contradictions enable row level security;
alter table growth.evidence_engine_snapshots enable row level security;

comment on table growth.evidence_engine_runs is
  'GE-AIOS-8A Evidence Engine orchestration runs per organization.';
comment on table growth.evidence_engine_evidence is
  'Auditable evidence observations with source lineage; facts must trace to evidence rows.';
comment on table growth.evidence_engine_facts is
  'Evidence-backed facts derived per run; supporting_evidence_ids required.';
comment on table growth.evidence_engine_contradictions is
  'Unresolved conflicting evidence requiring human review.';
comment on table growth.evidence_engine_snapshots is
  'Point-in-time Ava understanding snapshot per organization (does not replace organization_business_profiles).';
