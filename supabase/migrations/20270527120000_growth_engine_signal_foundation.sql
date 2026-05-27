-- Growth Engine — Intent Signals foundation (Milestone A).
-- Evidence-backed normalized signals for platform admin. Service-role access only.

do $$
begin
  if to_regnamespace('growth') is null then
    raise exception 'Missing dependency: growth schema';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'Missing dependency: public.set_updated_at()';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.signal_providers
-- -----------------------------------------------------------------------------

create table if not exists growth.signal_providers (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique
    check (char_length(trim(provider_key)) > 0),
  display_name text not null default '',
  status text not null default 'active'
    check (status in ('active', 'inactive', 'stub')),
  supported_signal_types text[] not null default '{}'::text[],
  capabilities jsonb not null default '{}'::jsonb,
  config_ref jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- growth.signals
-- -----------------------------------------------------------------------------

create table if not exists growth.signals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  signal_type text not null
    check (signal_type in (
      'website_visitor',
      'job_change',
      'promotion',
      'hire',
      'job_posting',
      'news_event',
      'tech_install',
      'funding_event',
      'search_intent',
      'manual_signal'
    )),
  provider_key text not null default 'manual_import',
  provider_event_id text,
  dedupe_hash text not null default '',
  confidence numeric not null default 0
    check (confidence >= 0 and confidence <= 1),
  signal_score int not null default 0
    check (signal_score >= 0 and signal_score <= 100),
  urgency text not null default 'normal'
    check (urgency in ('low', 'normal', 'high', 'urgent')),
  routing_priority int not null default 0,
  occurred_at timestamptz not null,
  detected_at timestamptz not null default now(),
  expires_at timestamptz,
  company_id uuid,
  company_name text not null default '',
  domain citext,
  contact_id uuid,
  contact_display_label text,
  title text,
  previous_title text,
  seniority text,
  geography text,
  industry text,
  category text,
  evidence_summary text not null default '',
  enrichment_metadata jsonb not null default '{}'::jsonb,
  workflow_state text not null default 'new'
    check (workflow_state in ('new', 'reviewed', 'routed', 'suppressed', 'expired')),
  processed_to_lead_inbox boolean not null default false,
  lead_inbox_id uuid,
  suppression_state text not null default 'active'
    check (suppression_state in ('active', 'suppressed', 'dismissed')),
  scoring_metadata jsonb not null default '{}'::jsonb,
  raw_payload_ref uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(trim(evidence_summary)) > 0)
);

create unique index if not exists signals_org_type_dedupe_idx
  on growth.signals (organization_id, signal_type, dedupe_hash)
  where dedupe_hash <> '';

create index if not exists signals_org_type_occurred_idx
  on growth.signals (organization_id, signal_type, occurred_at desc);

create index if not exists signals_org_score_idx
  on growth.signals (organization_id, signal_score desc);

create index if not exists signals_workflow_state_idx
  on growth.signals (workflow_state, detected_at desc);

create index if not exists signals_urgency_idx
  on growth.signals (urgency, occurred_at desc);

create index if not exists signals_domain_idx
  on growth.signals (domain, occurred_at desc);

create index if not exists signals_company_id_idx
  on growth.signals (company_id, signal_type);

-- -----------------------------------------------------------------------------
-- growth.signal_sources
-- -----------------------------------------------------------------------------

create table if not exists growth.signal_sources (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid not null references growth.signals (id) on delete cascade,
  organization_id uuid,
  source_type text not null default 'manual'
    check (source_type in (
      'website',
      'team_page',
      'contact_page',
      'about_page',
      'careers_page',
      'google_business',
      'linkedin_company',
      'press_news',
      'review_site',
      'job_posting',
      'tech_stack',
      'public_record',
      'manual',
      'intent_pixel',
      'search_intent',
      'other'
    )),
  source_label text not null default '',
  source_url text,
  publisher text,
  excerpt text not null default '',
  observed_at timestamptz not null default now(),
  confidence_score numeric not null default 0,
  dedupe_hash text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(trim(excerpt)) > 0 or source_url is not null)
);

create index if not exists signal_sources_signal_idx
  on growth.signal_sources (signal_id, observed_at desc);

create unique index if not exists signal_sources_dedupe_idx
  on growth.signal_sources (signal_id, dedupe_hash)
  where dedupe_hash <> '';

-- -----------------------------------------------------------------------------
-- growth.signal_targets
-- -----------------------------------------------------------------------------

create table if not exists growth.signal_targets (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid not null references growth.signals (id) on delete cascade,
  organization_id uuid,
  target_kind text not null
    check (target_kind in ('company', 'contact', 'domain', 'territory', 'lead', 'other')),
  target_ref text not null default '',
  target_label text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists signal_targets_signal_idx
  on growth.signal_targets (signal_id);

create index if not exists signal_targets_kind_ref_idx
  on growth.signal_targets (target_kind, target_ref);

-- -----------------------------------------------------------------------------
-- growth.signal_events
-- -----------------------------------------------------------------------------

create table if not exists growth.signal_events (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid references growth.signals (id) on delete set null,
  organization_id uuid,
  event_type text not null
    check (event_type in (
      'ingested',
      'scored',
      'routed',
      'suppressed',
      'rejected_no_evidence',
      'rejected_duplicate',
      'expired',
      'error'
    )),
  event_payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists signal_events_signal_idx
  on growth.signal_events (signal_id, occurred_at desc);

create index if not exists signal_events_type_idx
  on growth.signal_events (event_type, occurred_at desc);

-- -----------------------------------------------------------------------------
-- growth.signal_ingestion_queue
-- -----------------------------------------------------------------------------

create table if not exists growth.signal_ingestion_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  provider_key text not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  scheduled_for timestamptz not null default now(),
  attempts int not null default 0,
  last_error text,
  cursor jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists signal_ingestion_queue_status_idx
  on growth.signal_ingestion_queue (status, scheduled_for asc);

create index if not exists signal_ingestion_queue_provider_idx
  on growth.signal_ingestion_queue (provider_key, status);

-- -----------------------------------------------------------------------------
-- growth.signal_raw_payloads (internal / server-only)
-- -----------------------------------------------------------------------------

create table if not exists growth.signal_raw_payloads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  provider_key text not null,
  provider_event_id text,
  payload jsonb not null default '{}'::jsonb,
  content_hash text not null default '',
  retention_until timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists signal_raw_payloads_provider_idx
  on growth.signal_raw_payloads (provider_key, created_at desc);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------

drop trigger if exists signal_providers_set_updated_at on growth.signal_providers;
create trigger signal_providers_set_updated_at
  before update on growth.signal_providers
  for each row execute function public.set_updated_at();

drop trigger if exists signals_set_updated_at on growth.signals;
create trigger signals_set_updated_at
  before update on growth.signals
  for each row execute function public.set_updated_at();

drop trigger if exists signal_sources_set_updated_at on growth.signal_sources;
create trigger signal_sources_set_updated_at
  before update on growth.signal_sources
  for each row execute function public.set_updated_at();

drop trigger if exists signal_targets_set_updated_at on growth.signal_targets;
create trigger signal_targets_set_updated_at
  before update on growth.signal_targets
  for each row execute function public.set_updated_at();

drop trigger if exists signal_ingestion_queue_set_updated_at on growth.signal_ingestion_queue;
create trigger signal_ingestion_queue_set_updated_at
  before update on growth.signal_ingestion_queue
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- seed manual import provider
-- -----------------------------------------------------------------------------

insert into growth.signal_providers (
  provider_key,
  display_name,
  status,
  supported_signal_types,
  capabilities,
  metadata
)
values (
  'manual_import',
  'Manual import',
  'active',
  array[
    'manual_signal',
    'news_event',
    'job_posting',
    'job_change',
    'promotion',
    'hire',
    'tech_install',
    'funding_event'
  ]::text[],
  '{"poll": false, "normalize": true, "manual_entry": true}'::jsonb,
  '{"qa_marker": "growth-signal-foundation-v1"}'::jsonb
)
on conflict (provider_key) do update set
  display_name = excluded.display_name,
  status = excluded.status,
  supported_signal_types = excluded.supported_signal_types,
  capabilities = excluded.capabilities,
  metadata = excluded.metadata,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- grants + RLS (service_role only)
-- -----------------------------------------------------------------------------

revoke all on table growth.signal_providers from public, anon, authenticated;
revoke all on table growth.signals from public, anon, authenticated;
revoke all on table growth.signal_sources from public, anon, authenticated;
revoke all on table growth.signal_targets from public, anon, authenticated;
revoke all on table growth.signal_events from public, anon, authenticated;
revoke all on table growth.signal_ingestion_queue from public, anon, authenticated;
revoke all on table growth.signal_raw_payloads from public, anon, authenticated;

grant select, insert, update, delete on table growth.signal_providers to service_role;
grant select, insert, update, delete on table growth.signals to service_role;
grant select, insert, update, delete on table growth.signal_sources to service_role;
grant select, insert, update, delete on table growth.signal_targets to service_role;
grant select, insert, update, delete on table growth.signal_events to service_role;
grant select, insert, update, delete on table growth.signal_ingestion_queue to service_role;
grant select, insert, update, delete on table growth.signal_raw_payloads to service_role;

alter table growth.signal_providers enable row level security;
alter table growth.signals enable row level security;
alter table growth.signal_sources enable row level security;
alter table growth.signal_targets enable row level security;
alter table growth.signal_events enable row level security;
alter table growth.signal_ingestion_queue enable row level security;
alter table growth.signal_raw_payloads enable row level security;

comment on table growth.signals is
  'Normalized intent signals (Milestone A). Every row requires evidence_summary; raw payloads stored separately.';

comment on table growth.signal_raw_payloads is
  'Internal-only provider payloads. Never expose through client-facing Growth APIs.';
