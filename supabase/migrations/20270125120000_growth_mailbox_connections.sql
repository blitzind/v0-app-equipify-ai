-- Growth Engine Phase 1B — Mailbox Connection Foundation (no sending, no OAuth execution).

do $$
begin
  if to_regclass('growth.sender_accounts') is null then
    raise exception 'Missing dependency: growth.sender_accounts';
  end if;
  if to_regclass('growth.platform_timeline_events') is null then
    raise exception 'Missing dependency: growth.platform_timeline_events';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.mailbox_connections
-- -----------------------------------------------------------------------------

create table if not exists growth.mailbox_connections (
  id uuid primary key default gen_random_uuid(),
  sender_account_id uuid not null references growth.sender_accounts (id) on delete cascade,
  provider_family text not null
    check (provider_family in ('google', 'microsoft', 'smtp', 'custom')),
  status text not null default 'pending'
    check (status in ('pending', 'connecting', 'connected', 'warning', 'expired', 'error', 'disabled')),
  email_address text not null default '',
  display_name text not null default '',
  encrypted_access_token text,
  encrypted_refresh_token text,
  token_expires_at timestamptz,
  last_refresh_attempt timestamptz,
  last_successful_refresh timestamptz,
  last_validation_at timestamptz,
  validation_failure_count integer not null default 0 check (validation_failure_count >= 0),
  provider_account_id text,
  provider_metadata jsonb not null default '{}'::jsonb,
  connection_health integer not null default 100 check (connection_health >= 0 and connection_health <= 100),
  health_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_growth_mailbox_connections_sender
  on growth.mailbox_connections (sender_account_id)
  where deleted_at is null;

create index if not exists idx_growth_mailbox_connections_provider_family
  on growth.mailbox_connections (provider_family)
  where deleted_at is null;

create index if not exists idx_growth_mailbox_connections_status
  on growth.mailbox_connections (status)
  where deleted_at is null;

create index if not exists idx_growth_mailbox_connections_deleted_at
  on growth.mailbox_connections (deleted_at);

comment on table growth.mailbox_connections is
  'Platform-admin mailbox connection registry — tokens encrypted at rest, no outbound sending in Phase 1B.';

-- -----------------------------------------------------------------------------
-- growth.mailbox_connection_events
-- -----------------------------------------------------------------------------

create table if not exists growth.mailbox_connection_events (
  id uuid primary key default gen_random_uuid(),
  mailbox_connection_id uuid not null references growth.mailbox_connections (id) on delete cascade,
  event_type text not null default 'health_check',
  severity text not null default 'low'
    check (severity in ('low', 'medium', 'high', 'critical')),
  title text not null default '',
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_mailbox_connection_events_mailbox
  on growth.mailbox_connection_events (mailbox_connection_id, created_at desc);

create index if not exists idx_growth_mailbox_connection_events_severity
  on growth.mailbox_connection_events (severity, created_at desc);

create index if not exists idx_growth_mailbox_connection_events_created
  on growth.mailbox_connection_events (created_at desc);

comment on table growth.mailbox_connection_events is
  'Mailbox connection health and validation event feed.';

-- -----------------------------------------------------------------------------
-- Extend platform timeline for mailbox events
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
    'domain_validated',
    'mailbox_connected',
    'mailbox_disconnected',
    'mailbox_validation_failed',
    'mailbox_token_expired',
    'mailbox_health_declined'
  ));

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.mailbox_connections from public, anon, authenticated;
revoke all on table growth.mailbox_connection_events from public, anon, authenticated;

grant select, insert, update, delete on table growth.mailbox_connections to service_role;
grant select, insert, update, delete on table growth.mailbox_connection_events to service_role;

alter table growth.mailbox_connections enable row level security;
alter table growth.mailbox_connection_events enable row level security;

alter table growth.mailbox_connections force row level security;
alter table growth.mailbox_connection_events force row level security;

create policy growth_mailbox_connections_service_role
  on growth.mailbox_connections for all to service_role using (true) with check (true);

create policy growth_mailbox_connection_events_service_role
  on growth.mailbox_connection_events for all to service_role using (true) with check (true);
