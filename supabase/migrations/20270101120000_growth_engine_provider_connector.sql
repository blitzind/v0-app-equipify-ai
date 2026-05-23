-- Growth Engine slice 5.3A: provider connector foundation (lifecycle, validation, capability history).

do $$
begin
  if to_regclass('growth.email_provider_connections') is null then
    raise exception 'Missing dependency: growth.email_provider_connections';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.email_provider_connections — lifecycle + validation health
-- -----------------------------------------------------------------------------

alter table growth.email_provider_connections
  add column if not exists lifecycle_status text not null default 'not_connected'
    check (lifecycle_status in ('not_connected', 'configuring', 'connected', 'warning', 'error', 'disabled')),
  add column if not exists health_reason text,
  add column if not exists last_validation_at timestamptz,
  add column if not exists last_validation_success_at timestamptz,
  add column if not exists validation_failure_count int not null default 0 check (validation_failure_count >= 0),
  add column if not exists last_error_message text,
  add column if not exists capability_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists last_validation_duration_ms int
    check (last_validation_duration_ms is null or last_validation_duration_ms >= 0),
  add column if not exists average_validation_duration_ms int
    check (average_validation_duration_ms is null or average_validation_duration_ms >= 0),
  add column if not exists temporarily_degraded boolean not null default false,
  add column if not exists degraded_reason text,
  add column if not exists degraded_until timestamptz,
  add column if not exists credential_last_rotated_at timestamptz,
  add column if not exists credential_rotation_recommended_at timestamptz,
  add column if not exists next_validation_allowed_at timestamptz;

-- Backfill lifecycle from legacy status
update growth.email_provider_connections
set lifecycle_status = case
  when status = 'disabled' then 'disabled'
  when status = 'error' then 'error'
  when credentials_encrypted is not null or provider = 'stub' then 'connected'
  else 'not_connected'
end
where lifecycle_status = 'not_connected';

create index if not exists idx_growth_email_connections_lifecycle
  on growth.email_provider_connections (lifecycle_status, updated_at desc);

-- -----------------------------------------------------------------------------
-- growth.provider_capability_history — append-only validation snapshots
-- -----------------------------------------------------------------------------

create table if not exists growth.provider_capability_history (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references growth.email_provider_connections (id) on delete cascade,
  validated_at timestamptz not null default now(),
  healthy boolean not null,
  duration_ms int not null check (duration_ms >= 0),
  lifecycle_status text not null,
  capability_snapshot jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  account_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_provider_capability_history_connection
  on growth.provider_capability_history (connection_id, validated_at desc);

comment on table growth.provider_capability_history is
  'Append-only provider validation capability snapshots (slice 5.3A).';

revoke all on table growth.provider_capability_history from public, anon, authenticated;
grant select, insert, update, delete on table growth.provider_capability_history to service_role;

alter table growth.provider_capability_history enable row level security;
alter table growth.provider_capability_history force row level security;

-- -----------------------------------------------------------------------------
-- growth.platform_timeline_events — platform-scoped provider audit
-- -----------------------------------------------------------------------------

create table if not exists growth.platform_timeline_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references growth.email_provider_connections (id) on delete set null,
  event_type text not null check (event_type in (
    'provider_connected', 'provider_validation_failed', 'provider_disabled', 'provider_reconnected'
  )),
  title text not null,
  summary text,
  payload jsonb not null default '{}'::jsonb,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_email text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_platform_timeline_connection
  on growth.platform_timeline_events (connection_id, occurred_at desc);

comment on table growth.platform_timeline_events is
  'Platform-admin provider connector audit timeline (slice 5.3A).';

revoke all on table growth.platform_timeline_events from public, anon, authenticated;
grant select, insert on table growth.platform_timeline_events to service_role;

alter table growth.platform_timeline_events enable row level security;
alter table growth.platform_timeline_events force row level security;
