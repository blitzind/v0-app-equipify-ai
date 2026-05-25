-- Growth Engine slice 6.28A: deterministic prospect intelligence research runs.
-- Service-role only. Human-reviewed recommendations; no autonomous sends.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.research_runs
-- -----------------------------------------------------------------------------

create table if not exists growth.research_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  status text not null
    check (status in ('queued', 'running', 'completed', 'failed')),
  website_url text,
  company_name text,
  industry_guess text,
  employee_size_guess text,
  revenue_size_guess text,
  website_maturity_score int
    check (website_maturity_score is null or (website_maturity_score >= 0 and website_maturity_score <= 100)),
  social_presence_score int
    check (social_presence_score is null or (social_presence_score >= 0 and social_presence_score <= 100)),
  reputation_score int
    check (reputation_score is null or (reputation_score >= 0 and reputation_score <= 100)),
  technology_score int
    check (technology_score is null or (technology_score >= 0 and technology_score <= 100)),
  detected_technologies jsonb not null default '[]'::jsonb,
  signals jsonb not null default '{}'::jsonb,
  competitors jsonb not null default '[]'::jsonb,
  research_summary text,
  suggested_pitch_angle text,
  suggested_sequence text,
  suggested_call_opening text,
  recommended_next_action text,
  research_confidence int
    check (research_confidence is null or (research_confidence >= 0 and research_confidence <= 100)),
  input_hash text,
  completed_at timestamptz,
  failed_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_research_runs_organization_id
  on growth.research_runs (organization_id);

create index if not exists idx_growth_research_runs_lead_id
  on growth.research_runs (lead_id, created_at desc);

create index if not exists idx_growth_research_runs_status
  on growth.research_runs (status, created_at desc);

create index if not exists idx_growth_research_runs_created_at
  on growth.research_runs (created_at desc);

create unique index if not exists idx_growth_research_runs_lead_active
  on growth.research_runs (lead_id)
  where status in ('queued', 'running');

create index if not exists idx_growth_research_runs_lead_completed_hash
  on growth.research_runs (lead_id, input_hash, created_at desc)
  where status = 'completed';

comment on table growth.research_runs is
  'Deterministic prospect intelligence research runs for Growth Engine (slice 6.28A).';

-- -----------------------------------------------------------------------------
-- Lead cache columns
-- -----------------------------------------------------------------------------

alter table growth.leads
  add column if not exists latest_prospect_research_run_id uuid references growth.research_runs (id) on delete set null,
  add column if not exists last_prospect_researched_at timestamptz,
  add column if not exists prospect_recommended_next_action text;

create index if not exists idx_growth_leads_latest_prospect_research_run
  on growth.leads (latest_prospect_research_run_id)
  where latest_prospect_research_run_id is not null;

-- -----------------------------------------------------------------------------
-- Privileges — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.research_runs from public, anon, authenticated;
grant select, insert, update, delete on table growth.research_runs to service_role;

alter table growth.research_runs enable row level security;
alter table growth.research_runs force row level security;
