-- Growth Engine Phase 1D — Warmup Engine Foundation (infrastructure only, no sending).

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
-- growth.warmup_profiles
-- -----------------------------------------------------------------------------

create table if not exists growth.warmup_profiles (
  id uuid primary key default gen_random_uuid(),
  sender_account_id uuid not null references growth.sender_accounts (id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'warming', 'paused', 'completed', 'disabled')),
  target_daily_volume integer not null default 150 check (target_daily_volume >= 0),
  current_daily_volume integer not null default 0 check (current_daily_volume >= 0),
  daily_increment integer not null default 0 check (daily_increment >= 0),
  warmup_days integer not null default 30 check (warmup_days > 0),
  warmup_progress integer not null default 0 check (warmup_progress >= 0 and warmup_progress <= 100),
  warmup_score integer not null default 100 check (warmup_score >= 0 and warmup_score <= 100),
  warmup_health text not null default 'healthy'
    check (warmup_health in ('healthy', 'warning', 'degraded', 'critical')),
  started_at timestamptz,
  completed_at timestamptz,
  last_progress_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_growth_warmup_profiles_sender
  on growth.warmup_profiles (sender_account_id)
  where deleted_at is null;

create index if not exists idx_growth_warmup_profiles_status
  on growth.warmup_profiles (status)
  where deleted_at is null;

create index if not exists idx_growth_warmup_profiles_health
  on growth.warmup_profiles (warmup_health)
  where deleted_at is null;

comment on table growth.warmup_profiles is
  'Deterministic warmup progression profiles per sender — no outbound execution in Phase 1D.';

-- -----------------------------------------------------------------------------
-- growth.warmup_schedule
-- -----------------------------------------------------------------------------

create table if not exists growth.warmup_schedule (
  id uuid primary key default gen_random_uuid(),
  warmup_profile_id uuid not null references growth.warmup_profiles (id) on delete cascade,
  day_number integer not null check (day_number > 0),
  planned_volume integer not null default 0 check (planned_volume >= 0),
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (warmup_profile_id, day_number)
);

create index if not exists idx_growth_warmup_schedule_profile
  on growth.warmup_schedule (warmup_profile_id, day_number asc);

comment on table growth.warmup_schedule is
  'Day-by-day planned warmup volume schedule — progression planning only.';

-- -----------------------------------------------------------------------------
-- growth.warmup_events
-- -----------------------------------------------------------------------------

create table if not exists growth.warmup_events (
  id uuid primary key default gen_random_uuid(),
  warmup_profile_id uuid not null references growth.warmup_profiles (id) on delete cascade,
  severity text not null default 'low'
    check (severity in ('low', 'medium', 'high', 'critical')),
  event_type text not null default 'health_check',
  title text not null default '',
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_warmup_events_profile
  on growth.warmup_events (warmup_profile_id, created_at desc);

create index if not exists idx_growth_warmup_events_severity
  on growth.warmup_events (severity, created_at desc)
  where resolved = false;

create index if not exists idx_growth_warmup_events_created
  on growth.warmup_events (created_at desc);

comment on table growth.warmup_events is
  'Warmup intelligence event feed for platform infrastructure monitoring.';

-- -----------------------------------------------------------------------------
-- Extend platform timeline for warmup events
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
    'mailbox_health_declined',
    'spf_missing',
    'dkim_missing',
    'dmarc_missing',
    'dns_health_declined',
    'deliverability_improved',
    'domain_warning_created',
    'warmup_started',
    'warmup_paused',
    'warmup_completed',
    'warmup_health_declined',
    'warmup_progress_milestone'
  ));

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.warmup_profiles from public, anon, authenticated;
revoke all on table growth.warmup_schedule from public, anon, authenticated;
revoke all on table growth.warmup_events from public, anon, authenticated;

grant select, insert, update, delete on table growth.warmup_profiles to service_role;
grant select, insert, update, delete on table growth.warmup_schedule to service_role;
grant select, insert, update, delete on table growth.warmup_events to service_role;

alter table growth.warmup_profiles enable row level security;
alter table growth.warmup_schedule enable row level security;
alter table growth.warmup_events enable row level security;

alter table growth.warmup_profiles force row level security;
alter table growth.warmup_schedule force row level security;
alter table growth.warmup_events force row level security;

create policy growth_warmup_profiles_service_role
  on growth.warmup_profiles for all to service_role using (true) with check (true);

create policy growth_warmup_schedule_service_role
  on growth.warmup_schedule for all to service_role using (true) with check (true);

create policy growth_warmup_events_service_role
  on growth.warmup_events for all to service_role using (true) with check (true);
