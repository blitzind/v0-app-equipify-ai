-- Growth Engine slice 4B.1: import batches, row outcomes, batch events, mapping profiles.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.lead_import_batches
-- -----------------------------------------------------------------------------

create table if not exists growth.lead_import_batches (
  id uuid primary key default gen_random_uuid(),
  batch_name text not null,
  source_vendor text not null,
  source_channel text,
  source_campaign text,
  vendor_schema_version text not null default '1',
  file_name text,
  storage_path text,
  row_count int not null default 0 check (row_count >= 0),
  imported_count int not null default 0 check (imported_count >= 0),
  updated_count int not null default 0 check (updated_count >= 0),
  skipped_count int not null default 0 check (skipped_count >= 0),
  duplicate_count int not null default 0 check (duplicate_count >= 0),
  error_count int not null default 0 check (error_count >= 0),
  research_completed_count int not null default 0 check (research_completed_count >= 0),
  call_ready_count int not null default 0 check (call_ready_count >= 0),
  decision_maker_confirmed_count int not null default 0 check (decision_maker_confirmed_count >= 0),
  interested_count int not null default 0 check (interested_count >= 0),
  converted_count int not null default 0 check (converted_count >= 0),
  email_fill_percent numeric(5, 2) check (email_fill_percent is null or (email_fill_percent >= 0 and email_fill_percent <= 100)),
  phone_fill_percent numeric(5, 2) check (phone_fill_percent is null or (phone_fill_percent >= 0 and phone_fill_percent <= 100)),
  website_fill_percent numeric(5, 2) check (website_fill_percent is null or (website_fill_percent >= 0 and website_fill_percent <= 100)),
  decision_maker_fill_percent numeric(5, 2) check (decision_maker_fill_percent is null or (decision_maker_fill_percent >= 0 and decision_maker_fill_percent <= 100)),
  import_quality_score int check (import_quality_score is null or (import_quality_score >= 0 and import_quality_score <= 100)),
  status text not null default 'partial'
    check (status in ('running', 'completed', 'partial', 'failed', 'cancelled')),
  column_mapping jsonb not null default '{}'::jsonb,
  mapping_profile_id uuid,
  options jsonb not null default '{}'::jsonb,
  validation_summary jsonb not null default '{}'::jsonb,
  preview_json jsonb,
  error_message text,
  created_by uuid references auth.users (id) on delete set null,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_lead_import_batches_status_created
  on growth.lead_import_batches (status, created_at desc);

create index if not exists idx_growth_lead_import_batches_vendor
  on growth.lead_import_batches (source_vendor, created_at desc);

-- -----------------------------------------------------------------------------
-- growth.lead_import_mapping_profiles
-- -----------------------------------------------------------------------------

create table if not exists growth.lead_import_mapping_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_vendor text not null,
  column_mapping jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_lead_import_mapping_profiles_vendor
  on growth.lead_import_mapping_profiles (source_vendor, created_at desc);

alter table growth.lead_import_batches
  add constraint fk_growth_lead_import_batches_mapping_profile
  foreign key (mapping_profile_id) references growth.lead_import_mapping_profiles (id) on delete set null;

-- -----------------------------------------------------------------------------
-- growth.lead_import_batch_rows
-- -----------------------------------------------------------------------------

create table if not exists growth.lead_import_batch_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references growth.lead_import_batches (id) on delete cascade,
  row_index int not null check (row_index >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'validated', 'imported', 'updated', 'skipped', 'duplicate', 'error')),
  action text check (action is null or action in ('create_new', 'merge', 'skip')),
  lead_id uuid references growth.leads (id) on delete set null,
  dedupe_key text,
  dedupe_confidence numeric(4, 3) check (dedupe_confidence is null or (dedupe_confidence >= 0 and dedupe_confidence <= 1)),
  matched_lead_id uuid references growth.leads (id) on delete set null,
  source_payload jsonb not null default '{}'::jsonb,
  normalized_payload jsonb not null default '{}'::jsonb,
  codes text[] not null default '{}'::text[],
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, row_index)
);

create index if not exists idx_growth_lead_import_batch_rows_batch_status
  on growth.lead_import_batch_rows (batch_id, status);

create index if not exists idx_growth_lead_import_batch_rows_matched_lead
  on growth.lead_import_batch_rows (matched_lead_id);

-- -----------------------------------------------------------------------------
-- growth.lead_import_batch_events — append-only
-- -----------------------------------------------------------------------------

create table if not exists growth.lead_import_batch_events (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references growth.lead_import_batches (id) on delete cascade,
  event_type text not null check (event_type in (
    'batch_created', 'file_uploaded', 'preview_generated', 'mapping_saved',
    'dry_run_completed', 'commit_started', 'commit_row', 'commit_completed',
    'commit_failed', 'batch_cancelled'
  )),
  title text not null,
  summary text,
  payload jsonb not null default '{}'::jsonb,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_email text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_lead_import_batch_events_batch_occurred
  on growth.lead_import_batch_events (batch_id, occurred_at desc);

-- -----------------------------------------------------------------------------
-- FK: leads.source_import_batch_id → lead_import_batches
-- -----------------------------------------------------------------------------

alter table growth.leads
  drop constraint if exists fk_growth_leads_source_import_batch;

alter table growth.leads
  add constraint fk_growth_leads_source_import_batch
  foreign key (source_import_batch_id) references growth.lead_import_batches (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Storage bucket (private, service-role uploads)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'growth-imports',
  'growth-imports',
  false,
  31457280,
  array['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel']::text[]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- RLS (service_role only — matches other growth tables)
-- -----------------------------------------------------------------------------

alter table growth.lead_import_batches enable row level security;
alter table growth.lead_import_batches force row level security;
alter table growth.lead_import_batch_rows enable row level security;
alter table growth.lead_import_batch_rows force row level security;
alter table growth.lead_import_batch_events enable row level security;
alter table growth.lead_import_batch_events force row level security;
alter table growth.lead_import_mapping_profiles enable row level security;
alter table growth.lead_import_mapping_profiles force row level security;

revoke all on growth.lead_import_batches from authenticated, anon;
revoke all on growth.lead_import_batch_rows from authenticated, anon;
revoke all on growth.lead_import_batch_events from authenticated, anon;
revoke all on growth.lead_import_mapping_profiles from authenticated, anon;
