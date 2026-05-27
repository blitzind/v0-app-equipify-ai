-- Growth Engine Phase 2W — Live Provider Setup + OAuth Connection Center.

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
-- growth.provider_connection_settings
-- -----------------------------------------------------------------------------

create table if not exists growth.provider_connection_settings (
  id uuid primary key default gen_random_uuid(),
  provider_family text not null unique
    check (provider_family in ('google', 'microsoft', 'smtp', 'ses', 'resend', 'custom')),
  status text not null default 'not_configured'
    check (status in ('not_configured', 'pending', 'connected', 'warning', 'expired', 'failed', 'disabled')),
  sender_account_id uuid,
  mailbox_connection_id uuid,
  delivery_provider_id uuid,
  webhook_endpoint_id uuid,
  oauth_account_email citext,
  oauth_scopes text[] not null default '{}'::text[],
  encrypted_credentials text,
  token_expires_at timestamptz,
  last_refresh_at timestamptz,
  last_refresh_status text,
  last_connection_check_at timestamptz,
  last_test_send_at timestamptz,
  config_warnings jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists provider_connection_settings_status_idx
  on growth.provider_connection_settings (status, updated_at desc);

-- -----------------------------------------------------------------------------
-- growth.provider_oauth_states
-- -----------------------------------------------------------------------------

create table if not exists growth.provider_oauth_states (
  id uuid primary key default gen_random_uuid(),
  provider_family text not null
    check (provider_family in ('google', 'microsoft')),
  state_token text not null unique,
  user_id uuid not null,
  return_to text not null default '/admin/growth/providers/setup',
  sender_account_id uuid,
  consumed_at timestamptz,
  expires_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists provider_oauth_states_expires_idx
  on growth.provider_oauth_states (expires_at asc)
  where consumed_at is null;

-- -----------------------------------------------------------------------------
-- growth.provider_connection_checks
-- -----------------------------------------------------------------------------

create table if not exists growth.provider_connection_checks (
  id uuid primary key default gen_random_uuid(),
  provider_family text not null
    check (provider_family in ('google', 'microsoft', 'smtp', 'ses', 'resend', 'custom')),
  check_type text not null
    check (check_type in ('test_connection', 'test_send', 'token_refresh', 'readiness')),
  status text not null
    check (status in ('passed', 'failed', 'warning', 'skipped')),
  message text not null default '',
  details jsonb not null default '{}'::jsonb,
  actor_user_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists provider_connection_checks_family_idx
  on growth.provider_connection_checks (provider_family, created_at desc);

-- -----------------------------------------------------------------------------
-- growth.provider_secret_audit_events
-- -----------------------------------------------------------------------------

create table if not exists growth.provider_secret_audit_events (
  id uuid primary key default gen_random_uuid(),
  provider_family text not null
    check (provider_family in ('google', 'microsoft', 'smtp', 'ses', 'resend', 'custom')),
  action text not null
    check (action in (
      'credentials_updated',
      'oauth_connected',
      'oauth_reconnect_started',
      'disabled',
      'reconnect',
      'webhook_secret_updated',
      'test_connection',
      'test_send'
    )),
  actor_user_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists provider_secret_audit_events_family_idx
  on growth.provider_secret_audit_events (provider_family, created_at desc);

-- -----------------------------------------------------------------------------
-- growth.provider_setup_readiness
-- -----------------------------------------------------------------------------

create table if not exists growth.provider_setup_readiness (
  id uuid primary key default gen_random_uuid(),
  provider_family text
    check (provider_family is null or provider_family in ('google', 'microsoft', 'smtp', 'ses', 'resend', 'custom')),
  check_key text not null
    check (check_key in (
      'oauth_configured',
      'credentials_present',
      'sender_connected',
      'mailbox_connected',
      'dns_valid',
      'webhook_configured',
      'tracking_domain_ready',
      'compliance_ready',
      'governance_ready',
      'test_send_passed'
    )),
  status text not null default 'fail'
    check (status in ('pass', 'fail', 'warning', 'skipped')),
  message text not null default '',
  last_checked_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists provider_setup_readiness_family_check_idx
  on growth.provider_setup_readiness (provider_family, check_key);

-- -----------------------------------------------------------------------------
-- triggers
-- -----------------------------------------------------------------------------

drop trigger if exists provider_connection_settings_set_updated_at on growth.provider_connection_settings;
create trigger provider_connection_settings_set_updated_at
  before update on growth.provider_connection_settings
  for each row execute function public.set_updated_at();

drop trigger if exists provider_setup_readiness_set_updated_at on growth.provider_setup_readiness;
create trigger provider_setup_readiness_set_updated_at
  before update on growth.provider_setup_readiness
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- grants + RLS
-- -----------------------------------------------------------------------------

revoke all on table growth.provider_connection_settings from public, anon, authenticated;
revoke all on table growth.provider_oauth_states from public, anon, authenticated;
revoke all on table growth.provider_connection_checks from public, anon, authenticated;
revoke all on table growth.provider_secret_audit_events from public, anon, authenticated;
revoke all on table growth.provider_setup_readiness from public, anon, authenticated;

grant select, insert, update, delete on table growth.provider_connection_settings to service_role;
grant select, insert, update, delete on table growth.provider_oauth_states to service_role;
grant select, insert, update, delete on table growth.provider_connection_checks to service_role;
grant select, insert, update, delete on table growth.provider_secret_audit_events to service_role;
grant select, insert, update, delete on table growth.provider_setup_readiness to service_role;

alter table growth.provider_connection_settings enable row level security;
alter table growth.provider_oauth_states enable row level security;
alter table growth.provider_connection_checks enable row level security;
alter table growth.provider_secret_audit_events enable row level security;
alter table growth.provider_setup_readiness enable row level security;

comment on table growth.provider_connection_settings is
  'Live provider setup registry (Phase 2W). Encrypted credentials only; no raw tokens in API responses.';
