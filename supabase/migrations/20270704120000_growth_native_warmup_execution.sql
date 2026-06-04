-- Growth Engine Phase 6.31A — Native mailbox warmup execution (capacity + lifecycle; no peer warmup bots).

do $$
begin
  if to_regclass('growth.warmup_profiles') is null then
    raise exception 'Missing dependency: growth.warmup_profiles';
  end if;
end;
$$;

-- Migrate legacy profile statuses to native lifecycle values.
update growth.warmup_profiles set status = 'new' where status = 'draft';
update growth.warmup_profiles set status = 'active' where status = 'completed';

alter table growth.warmup_profiles drop constraint if exists warmup_profiles_status_check;

alter table growth.warmup_profiles
  add constraint warmup_profiles_status_check
  check (status in ('new', 'warming', 'active', 'throttled', 'paused', 'disabled'));

alter table growth.warmup_profiles
  alter column status set default 'new';

alter table growth.warmup_profiles
  add column if not exists current_warmup_day integer not null default 1 check (current_warmup_day > 0),
  add column if not exists sends_today integer not null default 0 check (sends_today >= 0),
  add column if not exists sends_today_date date,
  add column if not exists throttled_at timestamptz,
  add column if not exists throttle_reason text,
  add column if not exists last_capacity_sync_at timestamptz;

alter table growth.warmup_schedule
  add column if not exists actual_volume integer not null default 0 check (actual_volume >= 0);

create index if not exists idx_growth_warmup_profiles_progression
  on growth.warmup_profiles (status, last_progress_at)
  where deleted_at is null and status in ('new', 'warming', 'throttled');

comment on column growth.warmup_profiles.sends_today is
  'Native outbound sends counted today toward warmup day cap (sequence transport).';
comment on column growth.warmup_profiles.current_warmup_day is
  'Calendar day index since started_at for ramp lookup (1-based).';

-- Platform timeline: warmup stage + throttle events
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
    'warmup_progress_milestone',
    'warmup_stage_changed',
    'warmup_throttled'
  ));
