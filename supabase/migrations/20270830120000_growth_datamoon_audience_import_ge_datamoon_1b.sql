-- GE-DATAMOON-1B — Datamoon Audience import runs and preview records.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.datamoon_audience_import_runs
-- -----------------------------------------------------------------------------

create table if not exists growth.datamoon_audience_import_runs (
  id uuid primary key default gen_random_uuid(),
  run_name text not null,
  datamoon_audience_id text,
  provider_mode text not null default 'ext'
    check (provider_mode in ('ext', 'module')),
  audience_type text not null
    check (audience_type in ('advanced_search', 'b2b', 'b2c')),
  filters jsonb not null default '[]'::jsonb,
  topic_ids jsonb not null default '[]'::jsonb,
  requested_limit int check (requested_limit is null or (requested_limit >= 1 and requested_limit <= 1000000)),
  audience_name text,
  website_id text,
  status text not null default 'pending_build'
    check (status in (
      'pending_build', 'building', 'completed', 'failed',
      'importing', 'imported', 'imported_partial'
    )),
  record_count int not null default 0 check (record_count >= 0),
  loading_count int not null default 0 check (loading_count >= 0),
  preview_count int not null default 0 check (preview_count >= 0),
  imported_count int not null default 0 check (imported_count >= 0),
  duplicate_count int not null default 0 check (duplicate_count >= 0),
  skipped_count int not null default 0 check (skipped_count >= 0),
  error_count int not null default 0 check (error_count >= 0),
  provider_metadata jsonb not null default '{}'::jsonb,
  error_message text,
  dry_run boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  last_polled_at timestamptz,
  completed_at timestamptz,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_datamoon_audience_import_runs_status_created
  on growth.datamoon_audience_import_runs (status, created_at desc);

create index if not exists idx_growth_datamoon_audience_import_runs_audience_id
  on growth.datamoon_audience_import_runs (datamoon_audience_id)
  where datamoon_audience_id is not null;

-- -----------------------------------------------------------------------------
-- growth.datamoon_audience_import_records — preview rows (no leads until import)
-- -----------------------------------------------------------------------------

create table if not exists growth.datamoon_audience_import_records (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references growth.datamoon_audience_import_runs (id) on delete cascade,
  record_index int not null check (record_index >= 0),
  status text not null default 'preview'
    check (status in ('preview', 'duplicate', 'imported', 'skipped', 'error')),
  normalized_payload jsonb not null default '{}'::jsonb,
  provider_record jsonb not null default '{}'::jsonb,
  dedupe_rule text,
  dedupe_key text,
  matched_lead_id uuid references growth.leads (id) on delete set null,
  lead_id uuid references growth.leads (id) on delete set null,
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, record_index)
);

create index if not exists idx_growth_datamoon_audience_import_records_run_status
  on growth.datamoon_audience_import_records (run_id, status);

create index if not exists idx_growth_datamoon_audience_import_records_lead
  on growth.datamoon_audience_import_records (lead_id)
  where lead_id is not null;

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------

drop trigger if exists trg_growth_datamoon_audience_import_runs_updated_at on growth.datamoon_audience_import_runs;
create trigger trg_growth_datamoon_audience_import_runs_updated_at
  before update on growth.datamoon_audience_import_runs
  for each row execute function public.set_updated_at();

drop trigger if exists trg_growth_datamoon_audience_import_records_updated_at on growth.datamoon_audience_import_records;
create trigger trg_growth_datamoon_audience_import_records_updated_at
  before update on growth.datamoon_audience_import_records
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS (service_role only — matches other growth tables)
-- -----------------------------------------------------------------------------

alter table growth.datamoon_audience_import_runs enable row level security;
alter table growth.datamoon_audience_import_runs force row level security;
alter table growth.datamoon_audience_import_records enable row level security;
alter table growth.datamoon_audience_import_records force row level security;

revoke all on growth.datamoon_audience_import_runs from public, authenticated, anon;
revoke all on growth.datamoon_audience_import_records from public, authenticated, anon;

grant select, insert, update, delete on table growth.datamoon_audience_import_runs to service_role;
grant select, insert, update, delete on table growth.datamoon_audience_import_records to service_role;
