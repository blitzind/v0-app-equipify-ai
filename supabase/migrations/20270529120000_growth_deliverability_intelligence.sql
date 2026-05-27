-- Growth Engine Phase 2: Live deliverability intelligence + domain protection.

alter table growth.sender_domains
  add column if not exists dkim_selector text,
  add column if not exists tracking_domain text,
  add column if not exists domain_age_note text,
  add column if not exists manual_override boolean not null default false,
  add column if not exists verification_source text not null default 'stub'
    check (verification_source in ('stub', 'live', 'manual_override')),
  add column if not exists last_verified_at timestamptz,
  add column if not exists verification_error text,
  add column if not exists domain_health_score integer not null default 0
    check (domain_health_score >= 0 and domain_health_score <= 100),
  add column if not exists domain_risk_level text not null default 'medium'
    check (domain_risk_level in ('low', 'medium', 'high', 'critical')),
  add column if not exists operational_status text not null default 'healthy'
    check (operational_status in ('healthy', 'warming', 'degraded', 'critical', 'paused'));

alter table growth.domain_dns_checks
  add column if not exists verification_source text not null default 'stub'
    check (verification_source in ('stub', 'live', 'manual_override')),
  add column if not exists last_verified_at timestamptz,
  add column if not exists verification_error text,
  add column if not exists raw_dns_responses jsonb not null default '{}'::jsonb,
  add column if not exists probe_duration_ms integer;

create table if not exists growth.delivery_event_timeline (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  normalized_type text not null,
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high', 'critical')),
  title text not null,
  summary text,
  sender_account_id uuid references growth.sender_accounts(id) on delete set null,
  domain_id uuid references growth.sender_domains(id) on delete set null,
  mailbox_connection_id uuid references growth.mailbox_connections(id) on delete set null,
  delivery_attempt_id uuid references growth.delivery_attempts(id) on delete set null,
  provider_delivery_event_id uuid,
  provider_family text,
  dedupe_key text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (dedupe_key)
);

create index if not exists delivery_event_timeline_occurred_idx
  on growth.delivery_event_timeline (occurred_at desc);

create index if not exists delivery_event_timeline_domain_occurred_idx
  on growth.delivery_event_timeline (domain_id, occurred_at desc);

create table if not exists growth.domain_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references growth.sender_domains(id) on delete cascade,
  snapshot_date date not null default (timezone('utc', now()))::date,
  domain_health_score integer not null default 0,
  domain_risk_level text not null default 'medium',
  operational_status text not null default 'healthy',
  bounce_rate numeric,
  complaint_rate numeric,
  send_failure_rate numeric,
  risk_reasons jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (domain_id, snapshot_date)
);

create table if not exists growth.mailbox_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  sender_account_id uuid not null references growth.sender_accounts(id) on delete cascade,
  mailbox_connection_id uuid references growth.mailbox_connections(id) on delete set null,
  snapshot_date date not null default (timezone('utc', now()))::date,
  trust_score integer not null default 100,
  fatigue_score integer not null default 0,
  operational_status text not null default 'healthy'
    check (operational_status in ('healthy', 'degraded', 'critical', 'paused')),
  risk_reasons jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (sender_account_id, snapshot_date)
);

create table if not exists growth.deliverability_protection_events (
  id uuid primary key default gen_random_uuid(),
  protection_type text not null,
  action_taken text not null
    check (action_taken in ('warn', 'degrade', 'cooldown', 'pause_sender', 'pause_domain', 'restrict_rotation')),
  entity_type text not null
    check (entity_type in ('sender', 'domain', 'mailbox', 'pool', 'platform')),
  entity_id uuid,
  reason text not null,
  reversible boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists deliverability_protection_events_created_idx
  on growth.deliverability_protection_events (created_at desc);

comment on table growth.delivery_event_timeline is
  'Unified operational delivery telemetry timeline — normalized from webhooks, transport, and protection events.';
