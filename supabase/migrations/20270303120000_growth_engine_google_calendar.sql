-- Growth Engine Slice 6.27A — Google Calendar integration (platform-admin, human-confirmed sync).

do $$
begin
  if to_regclass('growth.meetings') is null then
    raise exception 'Missing dependency: growth.meetings';
  end if;
end;
$$;

create table if not exists growth.calendar_provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'google_calendar',
  account_email text,
  account_type text not null default 'unknown',
  status text not null default 'connected',
  access_token text not null,
  refresh_token text not null,
  access_token_expires_at timestamptz not null,
  refresh_token_expires_at timestamptz,
  scopes text[] not null default '{}',
  sync_health text not null default 'healthy',
  last_sync_at timestamptz,
  last_sync_error text,
  connected_at timestamptz not null default now(),
  disconnected_at timestamptz,
  qa_marker text not null default 'google-calendar-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_provider_connections_provider_check
    check (provider in ('google_calendar')),
  constraint calendar_provider_connections_account_type_check
    check (account_type in ('workspace', 'personal', 'unknown')),
  constraint calendar_provider_connections_status_check
    check (status in ('connected', 'disconnected', 'error')),
  constraint calendar_provider_connections_sync_health_check
    check (sync_health in ('healthy', 'degraded', 'failed'))
);

create unique index if not exists idx_growth_calendar_connections_user_provider
  on growth.calendar_provider_connections (user_id, provider)
  where status = 'connected';

alter table growth.meetings
  add column if not exists calendar_sync_status text,
  add column if not exists calendar_sync_error text,
  add column if not exists calendar_synced_at timestamptz,
  add column if not exists calendar_last_sync_at timestamptz,
  add column if not exists meeting_url text,
  add column if not exists notes text,
  add column if not exists attendee_emails jsonb not null default '[]'::jsonb,
  add column if not exists timezone text not null default 'UTC';

alter table growth.meetings
  drop constraint if exists meetings_calendar_sync_status_check;

alter table growth.meetings
  add constraint meetings_calendar_sync_status_check
  check (
    calendar_sync_status is null
    or calendar_sync_status in ('pending', 'synced', 'failed', 'conflict')
  );

create index if not exists idx_growth_meetings_calendar_sync_status
  on growth.meetings (calendar_sync_status, calendar_last_sync_at desc nulls last)
  where calendar_sync_status is not null;

alter table growth.calendar_provider_connections enable row level security;
alter table growth.calendar_provider_connections force row level security;

grant select, insert, update, delete on growth.calendar_provider_connections to service_role;
