-- Growth Engine Phase 7.7B — Buying committee intelligence job queue (async runtime integration).

do $$
begin
  if to_regclass('growth.buying_committee_runs') is null then
    raise exception 'Missing dependency: growth.buying_committee_runs';
  end if;
end;
$$;

create table if not exists growth.buying_committee_jobs (
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
      'company_intelligence_completed',
      'browser_extension',
      'infrastructure_panel'
    )),

  scheduled_for timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  attempts int not null default 0 check (attempts >= 0),
  last_error text,

  run_id uuid references growth.buying_committee_runs (id) on delete set null,
  promote_on_complete boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists buying_committee_jobs_status_scheduled_idx
  on growth.buying_committee_jobs (status, scheduled_for asc)
  where status = 'pending';

create index if not exists buying_committee_jobs_company_idx
  on growth.buying_committee_jobs (company_id, created_at desc);

create unique index if not exists buying_committee_jobs_active_company_uidx
  on growth.buying_committee_jobs (company_id)
  where status in ('pending', 'running');

drop trigger if exists trg_growth_buying_committee_jobs_updated_at on growth.buying_committee_jobs;
create trigger trg_growth_buying_committee_jobs_updated_at
  before update on growth.buying_committee_jobs
  for each row execute function public.set_updated_at();

revoke all on table growth.buying_committee_jobs from public, anon, authenticated;
grant select, insert, update, delete on table growth.buying_committee_jobs to service_role;
alter table growth.buying_committee_jobs enable row level security;

comment on table growth.buying_committee_jobs is
  'Bounded async buying committee intelligence queue (7.7B). One active job per canonical company.';
