-- Growth Engine Phase 7.6B — Company intelligence job queue (async runtime integration).

do $$
begin
  if to_regclass('growth.company_intelligence_runs') is null then
    raise exception 'Missing dependency: growth.company_intelligence_runs';
  end if;
end;
$$;

create table if not exists growth.company_intelligence_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  company_id uuid not null references growth.companies (id) on delete cascade,
  created_by uuid,

  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  trigger_source text not null default 'manual'
    check (trigger_source in (
      'manual',
      'company_enriched',
      'browser_extension',
      'infrastructure_panel'
    )),

  scheduled_for timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  attempts int not null default 0 check (attempts >= 0),
  last_error text,

  run_id uuid references growth.company_intelligence_runs (id) on delete set null,
  promote_on_complete boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists company_intelligence_jobs_status_scheduled_idx
  on growth.company_intelligence_jobs (status, scheduled_for asc)
  where status = 'pending';

create index if not exists company_intelligence_jobs_company_idx
  on growth.company_intelligence_jobs (company_id, created_at desc);

create unique index if not exists company_intelligence_jobs_active_company_uidx
  on growth.company_intelligence_jobs (company_id)
  where status in ('pending', 'running');

drop trigger if exists trg_growth_company_intelligence_jobs_updated_at on growth.company_intelligence_jobs;
create trigger trg_growth_company_intelligence_jobs_updated_at
  before update on growth.company_intelligence_jobs
  for each row execute function public.set_updated_at();

revoke all on table growth.company_intelligence_jobs from public, anon, authenticated;
grant select, insert, update, delete on table growth.company_intelligence_jobs to service_role;
alter table growth.company_intelligence_jobs enable row level security;

comment on table growth.company_intelligence_jobs is
  'Bounded async company intelligence queue (7.6B). One active job per canonical company.';
