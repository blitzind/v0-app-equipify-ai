-- Growth Engine Phase 2D — Live Provider Transport Layer (human-approved sends only).

do $$
begin
  if to_regclass('growth.delivery_providers') is null then
    raise exception 'Missing dependency: growth.delivery_providers';
  end if;
  if to_regclass('growth.sender_accounts') is null then
    raise exception 'Missing dependency: growth.sender_accounts';
  end if;
  if to_regclass('growth.platform_timeline_events') is null then
    raise exception 'Missing dependency: growth.platform_timeline_events';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.delivery_attempts
-- -----------------------------------------------------------------------------

create table if not exists growth.delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references growth.delivery_providers (id) on delete cascade,
  sender_account_id uuid not null references growth.sender_accounts (id) on delete cascade,
  lead_id uuid references growth.leads (id) on delete set null,
  sequence_enrollment_id uuid,
  channel text not null default 'email'
    check (channel in ('email')),
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed', 'retry_scheduled', 'cancelled')),
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz,
  provider_message_id text,
  failure_reason text,
  retry_count integer not null default 0 check (retry_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_delivery_attempts_provider
  on growth.delivery_attempts (provider_id);

create index if not exists idx_growth_delivery_attempts_sender
  on growth.delivery_attempts (sender_account_id);

create index if not exists idx_growth_delivery_attempts_status
  on growth.delivery_attempts (status);

create index if not exists idx_growth_delivery_attempts_queued_at
  on growth.delivery_attempts (queued_at desc);

comment on table growth.delivery_attempts is
  'Outbound delivery transport attempts — human-approved sends only, audited per attempt.';

-- -----------------------------------------------------------------------------
-- growth.provider_rate_limits
-- -----------------------------------------------------------------------------

create table if not exists growth.provider_rate_limits (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null unique references growth.delivery_providers (id) on delete cascade,
  minute_cap integer not null default 10 check (minute_cap >= 0),
  hour_cap integer not null default 100 check (hour_cap >= 0),
  day_cap integer not null default 1000 check (day_cap >= 0),
  current_minute integer not null default 0 check (current_minute >= 0),
  current_hour integer not null default 0 check (current_hour >= 0),
  current_day integer not null default 0 check (current_day >= 0),
  window_started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_provider_rate_limits_provider
  on growth.provider_rate_limits (provider_id);

comment on table growth.provider_rate_limits is
  'Per-provider transport rate limit counters — enforced before send execution.';

-- -----------------------------------------------------------------------------
-- Extend platform timeline for live transport events
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
    'warmup_progress_milestone',
    'sequence_created',
    'sequence_started',
    'sequence_paused',
    'sequence_completed',
    'sequence_cancelled',
    'sequence_health_declined',
    'reply_detected',
    'positive_interest_detected',
    'budget_objection_detected',
    'timeline_objection_detected',
    'meeting_interest_detected',
    'unsubscribe_detected',
    'thread_owner_assigned',
    'delivery_route_changed',
    'fallback_route_triggered',
    'delivery_queued',
    'delivery_sent',
    'delivery_failed',
    'delivery_retry',
    'rate_limit_hit'
  ));

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.delivery_attempts from public, anon, authenticated;
revoke all on table growth.provider_rate_limits from public, anon, authenticated;

grant select, insert, update, delete on table growth.delivery_attempts to service_role;
grant select, insert, update, delete on table growth.provider_rate_limits to service_role;

alter table growth.delivery_attempts enable row level security;
alter table growth.provider_rate_limits enable row level security;

alter table growth.delivery_attempts force row level security;
alter table growth.provider_rate_limits force row level security;

create policy growth_delivery_attempts_service_role
  on growth.delivery_attempts for all to service_role using (true) with check (true);

create policy growth_provider_rate_limits_service_role
  on growth.provider_rate_limits for all to service_role using (true) with check (true);
