-- Growth Engine Slice 6.12C — Realtime provider production readiness + diagnostics

alter table growth.realtime_provider_connections
  add column if not exists auth_configured boolean not null default false,
  add column if not exists last_successful_connection_at timestamptz,
  add column if not exists reliability_score int not null default 0
    check (reliability_score >= 0 and reliability_score <= 100),
  add column if not exists stream_failure_count int not null default 0
    check (stream_failure_count >= 0),
  add column if not exists reconnect_count int not null default 0
    check (reconnect_count >= 0),
  add column if not exists rate_limit_event_count int not null default 0
    check (rate_limit_event_count >= 0),
  add column if not exists last_disconnect_reason text,
  add column if not exists temporarily_degraded boolean not null default false,
  add column if not exists degraded_reason text,
  add column if not exists degraded_until timestamptz,
  add column if not exists circuit_open boolean not null default false,
  add column if not exists circuit_open_until timestamptz,
  add column if not exists validation_failure_count int not null default 0
    check (validation_failure_count >= 0),
  add column if not exists last_validation_at timestamptz,
  add column if not exists last_validation_success_at timestamptz,
  add column if not exists last_validation_duration_ms int not null default 0
    check (last_validation_duration_ms >= 0),
  add column if not exists next_validation_allowed_at timestamptz,
  add column if not exists readiness_status text not null default 'not_ready'
    check (readiness_status in ('not_ready', 'ready', 'degraded', 'circuit_open')),
  add column if not exists configuration_warnings jsonb not null default '[]'::jsonb;

create table if not exists growth.realtime_provider_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references growth.realtime_provider_connections (id) on delete cascade,
  session_id uuid references growth.realtime_call_sessions (id) on delete set null,
  event_type text not null check (
    event_type in (
      'stream_open',
      'stream_close',
      'reconnect_attempt',
      'provider_failure',
      'provider_recovery',
      'auth_failure',
      'rate_limit',
      'timeout',
      'degraded_mode',
      'validation_success',
      'validation_failure',
      'circuit_open',
      'circuit_close',
      'stale_cleanup',
      'orphan_cleanup'
    )
  ),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_realtime_provider_lifecycle_events_connection_created
  on growth.realtime_provider_lifecycle_events (connection_id, created_at desc);

create index if not exists idx_realtime_provider_lifecycle_events_type_created
  on growth.realtime_provider_lifecycle_events (event_type, created_at desc);

revoke all on table growth.realtime_provider_lifecycle_events from public, anon, authenticated;
grant select, insert on table growth.realtime_provider_lifecycle_events to service_role;
alter table growth.realtime_provider_lifecycle_events enable row level security;
alter table growth.realtime_provider_lifecycle_events force row level security;
