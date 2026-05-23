-- Growth Engine slice 2A follow-up: business-level research cache hash + lead tracking + priority.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
  if to_regclass('growth.lead_research_runs') is null then
    raise exception 'Missing dependency: growth.lead_research_runs';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.leads — research tracking + priority
-- -----------------------------------------------------------------------------

alter table growth.leads
  add column if not exists latest_research_run_id uuid references growth.lead_research_runs (id) on delete set null,
  add column if not exists last_researched_at timestamptz,
  add column if not exists research_priority text not null default 'normal'
    check (research_priority in ('low', 'normal', 'high', 'critical'));

create index if not exists idx_growth_leads_research_priority_status
  on growth.leads (research_priority, status, created_at desc);

create index if not exists idx_growth_leads_last_researched
  on growth.leads (last_researched_at desc nulls last)
  where last_researched_at is not null;

-- -----------------------------------------------------------------------------
-- growth.lead_research_runs — business-level input hash for 30-day cache
-- -----------------------------------------------------------------------------

alter table growth.lead_research_runs
  add column if not exists input_hash text;

create index if not exists idx_growth_lead_research_runs_cache_lookup
  on growth.lead_research_runs (lead_id, input_hash, finished_at desc)
  where status = 'succeeded' and input_hash is not null;
