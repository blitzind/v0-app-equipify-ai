-- Growth Engine Phase 1A — Sender Infrastructure Foundation (no sending, no warmup execution).

do $$
begin
  if to_regclass('growth.email_provider_connections') is null then
    raise exception 'Missing dependency: growth.email_provider_connections';
  end if;
  if to_regclass('growth.platform_timeline_events') is null then
    raise exception 'Missing dependency: growth.platform_timeline_events';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.sender_accounts
-- -----------------------------------------------------------------------------

create table if not exists growth.sender_accounts (
  id uuid primary key default gen_random_uuid(),
  provider_family text not null
    check (provider_family in ('google', 'microsoft', 'smtp', 'custom')),
  provider_connection_id uuid references growth.email_provider_connections (id) on delete set null,
  display_name text not null default '',
  email_address text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'connecting', 'connected', 'warning', 'disabled', 'error')),
  daily_send_limit integer not null default 50 check (daily_send_limit >= 0),
  daily_send_used integer not null default 0 check (daily_send_used >= 0),
  warmup_eligible boolean not null default true,
  warmup_enabled boolean not null default false,
  sender_score integer not null default 100 check (sender_score >= 0 and sender_score <= 100),
  health_status text not null default 'healthy'
    check (health_status in ('healthy', 'warming', 'degraded', 'critical')),
  last_health_check timestamptz,
  last_send_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_growth_sender_accounts_status
  on growth.sender_accounts (status)
  where deleted_at is null;

create index if not exists idx_growth_sender_accounts_provider_family
  on growth.sender_accounts (provider_family)
  where deleted_at is null;

create index if not exists idx_growth_sender_accounts_health_status
  on growth.sender_accounts (health_status)
  where deleted_at is null;

create index if not exists idx_growth_sender_accounts_deleted_at
  on growth.sender_accounts (deleted_at);

create index if not exists idx_growth_sender_accounts_active
  on growth.sender_accounts (created_at desc)
  where deleted_at is null;

comment on table growth.sender_accounts is
  'Platform-admin sender identity infrastructure — no outbound sending in Phase 1A.';

-- -----------------------------------------------------------------------------
-- growth.sender_domains
-- -----------------------------------------------------------------------------

create table if not exists growth.sender_domains (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'valid', 'warning', 'invalid')),
  spf_valid boolean not null default false,
  dkim_valid boolean not null default false,
  dmarc_valid boolean not null default false,
  mx_valid boolean not null default false,
  dns_checked_at timestamptz,
  deliverability_score integer not null default 0 check (deliverability_score >= 0 and deliverability_score <= 100),
  reputation_score integer not null default 100 check (reputation_score >= 0 and reputation_score <= 100),
  bounce_rate numeric,
  reply_rate numeric,
  spam_risk numeric,
  health_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_sender_domains_status
  on growth.sender_domains (status);

create index if not exists idx_growth_sender_domains_deliverability
  on growth.sender_domains (deliverability_score desc);

comment on table growth.sender_domains is
  'Sender domain DNS/deliverability records — validation stub-safe in Phase 1A.';

-- -----------------------------------------------------------------------------
-- growth.sender_health_events
-- -----------------------------------------------------------------------------

create table if not exists growth.sender_health_events (
  id uuid primary key default gen_random_uuid(),
  sender_account_id uuid references growth.sender_accounts (id) on delete cascade,
  domain_id uuid references growth.sender_domains (id) on delete set null,
  event_type text not null default 'health_check',
  severity text not null default 'low'
    check (severity in ('low', 'medium', 'high', 'critical')),
  title text not null default '',
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_sender_health_events_sender
  on growth.sender_health_events (sender_account_id, created_at desc);

create index if not exists idx_growth_sender_health_events_severity
  on growth.sender_health_events (severity)
  where resolved = false;

create index if not exists idx_growth_sender_health_events_resolved
  on growth.sender_health_events (resolved, created_at desc);

create index if not exists idx_growth_sender_health_events_created
  on growth.sender_health_events (created_at desc);

comment on table growth.sender_health_events is
  'Sender/domain health event feed for platform infrastructure monitoring.';

-- -----------------------------------------------------------------------------
-- growth.sender_reputation_snapshots
-- -----------------------------------------------------------------------------

create table if not exists growth.sender_reputation_snapshots (
  id uuid primary key default gen_random_uuid(),
  sender_account_id uuid not null references growth.sender_accounts (id) on delete cascade,
  snapshot_date date not null default current_date,
  deliverability_score integer not null default 0 check (deliverability_score >= 0 and deliverability_score <= 100),
  bounce_rate numeric,
  reply_rate numeric,
  spam_risk numeric,
  daily_send_volume integer not null default 0 check (daily_send_volume >= 0),
  created_at timestamptz not null default now(),
  unique (sender_account_id, snapshot_date)
);

create index if not exists idx_growth_sender_reputation_snapshots_sender
  on growth.sender_reputation_snapshots (sender_account_id, snapshot_date desc);

comment on table growth.sender_reputation_snapshots is
  'Daily sender reputation snapshots for deterministic scoring inputs.';

-- -----------------------------------------------------------------------------
-- Extend platform timeline for sender infrastructure events
-- -----------------------------------------------------------------------------

alter table growth.platform_timeline_events
  drop constraint if exists platform_timeline_events_event_type_check;

alter table growth.platform_timeline_events
  add constraint platform_timeline_events_event_type_check
  check (event_type in (
    'provider_connected',
    'provider_validation_failed',
    'provider_disabled',
    'provider_reconnected',
    'sender_connected',
    'sender_disabled',
    'sender_score_changed',
    'domain_health_declined',
    'domain_validated'
  ));

-- -----------------------------------------------------------------------------
-- RLS — service role only (platform admin via API)
-- -----------------------------------------------------------------------------

revoke all on table growth.sender_accounts from public, anon, authenticated;
revoke all on table growth.sender_domains from public, anon, authenticated;
revoke all on table growth.sender_health_events from public, anon, authenticated;
revoke all on table growth.sender_reputation_snapshots from public, anon, authenticated;

grant select, insert, update, delete on table growth.sender_accounts to service_role;
grant select, insert, update, delete on table growth.sender_domains to service_role;
grant select, insert, update, delete on table growth.sender_health_events to service_role;
grant select, insert, update, delete on table growth.sender_reputation_snapshots to service_role;

alter table growth.sender_accounts enable row level security;
alter table growth.sender_domains enable row level security;
alter table growth.sender_health_events enable row level security;
alter table growth.sender_reputation_snapshots enable row level security;

alter table growth.sender_accounts force row level security;
alter table growth.sender_domains force row level security;
alter table growth.sender_health_events force row level security;
alter table growth.sender_reputation_snapshots force row level security;

create policy growth_sender_accounts_service_role
  on growth.sender_accounts for all to service_role using (true) with check (true);

create policy growth_sender_domains_service_role
  on growth.sender_domains for all to service_role using (true) with check (true);

create policy growth_sender_health_events_service_role
  on growth.sender_health_events for all to service_role using (true) with check (true);

create policy growth_sender_reputation_snapshots_service_role
  on growth.sender_reputation_snapshots for all to service_role using (true) with check (true);
