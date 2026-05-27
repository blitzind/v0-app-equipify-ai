-- Growth Engine Phase 1C — DNS Validation + Deliverability Intelligence (stub-safe, no live DNS).

do $$
begin
  if to_regclass('growth.sender_domains') is null then
    raise exception 'Missing dependency: growth.sender_domains';
  end if;
  if to_regclass('growth.platform_timeline_events') is null then
    raise exception 'Missing dependency: growth.platform_timeline_events';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.domain_dns_checks
-- -----------------------------------------------------------------------------

create table if not exists growth.domain_dns_checks (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references growth.sender_domains (id) on delete cascade,
  spf_present boolean not null default false,
  spf_valid boolean not null default false,
  dkim_present boolean not null default false,
  dkim_valid boolean not null default false,
  dmarc_present boolean not null default false,
  dmarc_valid boolean not null default false,
  mx_present boolean not null default false,
  mx_valid boolean not null default false,
  mx_provider text,
  dns_health_score integer not null default 0 check (dns_health_score >= 0 and dns_health_score <= 100),
  health_tier text not null default 'critical'
    check (health_tier in ('healthy', 'warning', 'degraded', 'critical')),
  warnings jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_domain_dns_checks_domain
  on growth.domain_dns_checks (domain_id, last_checked_at desc);

create index if not exists idx_growth_domain_dns_checks_health_tier
  on growth.domain_dns_checks (health_tier);

create index if not exists idx_growth_domain_dns_checks_last_checked
  on growth.domain_dns_checks (last_checked_at desc);

comment on table growth.domain_dns_checks is
  'Stub-safe DNS authentication check results per sender domain — no live DNS in Phase 1C.';

-- -----------------------------------------------------------------------------
-- growth.deliverability_snapshots
-- -----------------------------------------------------------------------------

create table if not exists growth.deliverability_snapshots (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references growth.sender_domains (id) on delete cascade,
  snapshot_date date not null default current_date,
  deliverability_score integer not null default 0 check (deliverability_score >= 0 and deliverability_score <= 100),
  bounce_risk integer not null default 0 check (bounce_risk >= 0 and bounce_risk <= 100),
  spam_risk integer not null default 0 check (spam_risk >= 0 and spam_risk <= 100),
  authentication_score integer not null default 0 check (authentication_score >= 0 and authentication_score <= 100),
  infrastructure_score integer not null default 0 check (infrastructure_score >= 0 and infrastructure_score <= 100),
  health_summary text,
  risk_level text not null default 'medium'
    check (risk_level in ('low', 'medium', 'high', 'critical')),
  created_at timestamptz not null default now(),
  unique (domain_id, snapshot_date)
);

create index if not exists idx_growth_deliverability_snapshots_domain
  on growth.deliverability_snapshots (domain_id, snapshot_date desc);

comment on table growth.deliverability_snapshots is
  'Daily deliverability intelligence snapshots per domain.';

-- -----------------------------------------------------------------------------
-- growth.deliverability_events
-- -----------------------------------------------------------------------------

create table if not exists growth.deliverability_events (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references growth.sender_domains (id) on delete cascade,
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

create index if not exists idx_growth_deliverability_events_severity
  on growth.deliverability_events (severity, created_at desc)
  where resolved = false;

create index if not exists idx_growth_deliverability_events_resolved
  on growth.deliverability_events (resolved, created_at desc);

create index if not exists idx_growth_deliverability_events_created
  on growth.deliverability_events (created_at desc);

comment on table growth.deliverability_events is
  'Deliverability intelligence event feed for platform infrastructure monitoring.';

-- -----------------------------------------------------------------------------
-- Extend platform timeline for deliverability events
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
    'domain_warning_created'
  ));

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.domain_dns_checks from public, anon, authenticated;
revoke all on table growth.deliverability_snapshots from public, anon, authenticated;
revoke all on table growth.deliverability_events from public, anon, authenticated;

grant select, insert, update, delete on table growth.domain_dns_checks to service_role;
grant select, insert, update, delete on table growth.deliverability_snapshots to service_role;
grant select, insert, update, delete on table growth.deliverability_events to service_role;

alter table growth.domain_dns_checks enable row level security;
alter table growth.deliverability_snapshots enable row level security;
alter table growth.deliverability_events enable row level security;

alter table growth.domain_dns_checks force row level security;
alter table growth.deliverability_snapshots force row level security;
alter table growth.deliverability_events force row level security;

create policy growth_domain_dns_checks_service_role
  on growth.domain_dns_checks for all to service_role using (true) with check (true);

create policy growth_deliverability_snapshots_service_role
  on growth.deliverability_snapshots for all to service_role using (true) with check (true);

create policy growth_deliverability_events_service_role
  on growth.deliverability_events for all to service_role using (true) with check (true);
