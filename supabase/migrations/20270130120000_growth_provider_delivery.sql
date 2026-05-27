-- Growth Engine Phase 2C — Provider Delivery Layer Foundation (orchestration only, no live sending).

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
-- growth.delivery_providers
-- -----------------------------------------------------------------------------

create table if not exists growth.delivery_providers (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  provider_name text not null default '',
  provider_family text not null default 'custom'
    check (provider_family in ('google', 'microsoft', 'smtp', 'ses', 'mailgun', 'postmark', 'resend', 'custom')),
  status text not null default 'draft'
    check (status in ('draft', 'connected', 'warning', 'degraded', 'disabled')),
  supports_send boolean not null default false,
  supports_reply_sync boolean not null default false,
  supports_tracking boolean not null default false,
  supports_templates boolean not null default false,
  supports_validation boolean not null default false,
  supports_webhooks boolean not null default false,
  supports_rate_limits boolean not null default false,
  max_daily_volume integer not null default 0 check (max_daily_volume >= 0),
  health_score integer not null default 100 check (health_score >= 0 and health_score <= 100),
  last_validation_at timestamptz,
  configuration_status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_growth_delivery_providers_family
  on growth.delivery_providers (provider_family)
  where deleted_at is null;

create index if not exists idx_growth_delivery_providers_status
  on growth.delivery_providers (status)
  where deleted_at is null;

comment on table growth.delivery_providers is
  'Delivery provider registry — transport abstraction only, no live sending in Phase 2C.';

-- -----------------------------------------------------------------------------
-- growth.delivery_routes
-- -----------------------------------------------------------------------------

create table if not exists growth.delivery_routes (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references growth.delivery_providers (id) on delete cascade,
  sender_account_id uuid not null references growth.sender_accounts (id) on delete cascade,
  priority integer not null default 100 check (priority >= 0),
  enabled boolean not null default true,
  daily_cap integer not null default 0 check (daily_cap >= 0),
  current_volume integer not null default 0 check (current_volume >= 0),
  health_weight integer not null default 100 check (health_weight >= 0 and health_weight <= 100),
  fallback_route_id uuid references growth.delivery_routes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_delivery_routes_provider
  on growth.delivery_routes (provider_id);

create index if not exists idx_growth_delivery_routes_sender
  on growth.delivery_routes (sender_account_id);

create index if not exists idx_growth_delivery_routes_enabled
  on growth.delivery_routes (enabled, priority desc);

comment on table growth.delivery_routes is
  'Sender-to-provider delivery routes with priority, caps, and fallback wiring.';

-- -----------------------------------------------------------------------------
-- growth.delivery_events
-- -----------------------------------------------------------------------------

create table if not exists growth.delivery_events (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references growth.delivery_providers (id) on delete cascade,
  severity text not null default 'low',
  event_type text not null default 'health_check',
  title text not null default '',
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_delivery_events_provider
  on growth.delivery_events (provider_id, created_at desc);

create index if not exists idx_growth_delivery_events_created
  on growth.delivery_events (created_at desc);

comment on table growth.delivery_events is
  'Delivery provider health and routing event feed.';

-- -----------------------------------------------------------------------------
-- Extend platform timeline for delivery routing events
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
    'fallback_route_triggered'
  ));

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.delivery_providers from public, anon, authenticated;
revoke all on table growth.delivery_routes from public, anon, authenticated;
revoke all on table growth.delivery_events from public, anon, authenticated;

grant select, insert, update, delete on table growth.delivery_providers to service_role;
grant select, insert, update, delete on table growth.delivery_routes to service_role;
grant select, insert, update, delete on table growth.delivery_events to service_role;

alter table growth.delivery_providers enable row level security;
alter table growth.delivery_routes enable row level security;
alter table growth.delivery_events enable row level security;

alter table growth.delivery_providers force row level security;
alter table growth.delivery_routes force row level security;
alter table growth.delivery_events force row level security;

create policy growth_delivery_providers_service_role
  on growth.delivery_providers for all to service_role using (true) with check (true);

create policy growth_delivery_routes_service_role
  on growth.delivery_routes for all to service_role using (true) with check (true);

create policy growth_delivery_events_service_role
  on growth.delivery_events for all to service_role using (true) with check (true);
