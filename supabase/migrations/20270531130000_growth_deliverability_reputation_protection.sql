-- Growth Engine Internal Operator Hardening Phase 1 — Deliverability & Reputation Protection v1

do $$
begin
  if to_regclass('growth.sender_accounts') is null then
    raise exception 'Missing dependency: growth.sender_accounts';
  end if;
  if to_regclass('growth.mailbox_connections') is null then
    raise exception 'Missing dependency: growth.mailbox_connections';
  end if;
end $$;

create table if not exists growth.mailbox_reputation_snapshots (
  id uuid primary key default gen_random_uuid(),
  sender_account_id uuid not null references growth.sender_accounts (id) on delete cascade,
  mailbox_connection_id uuid references growth.mailbox_connections (id) on delete set null,
  snapshot_date date not null default (timezone('utc', now()))::date,
  email_address text not null default '',
  daily_send_count integer not null default 0 check (daily_send_count >= 0),
  rolling_7d_send_volume integer not null default 0 check (rolling_7d_send_volume >= 0),
  rolling_30d_send_volume integer not null default 0 check (rolling_30d_send_volume >= 0),
  bounce_rate numeric not null default 0,
  reply_rate numeric not null default 0,
  positive_reply_rate numeric not null default 0,
  unsubscribe_rate numeric not null default 0,
  spam_complaint_rate numeric not null default 0,
  open_rate numeric not null default 0,
  inactivity_days integer not null default 0 check (inactivity_days >= 0),
  sequence_participation_count integer not null default 0 check (sequence_participation_count >= 0),
  warmup_status text,
  warmup_progress numeric,
  risk_score integer not null default 100 check (risk_score >= 0 and risk_score <= 100),
  health_tier text not null default 'healthy'
    check (health_tier in ('healthy', 'warming', 'caution', 'high_risk', 'protected', 'paused')),
  risk_reasons jsonb not null default '[]'::jsonb,
  recommended_actions jsonb not null default '[]'::jsonb,
  score_explanation jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (sender_account_id, snapshot_date)
);

create index if not exists mailbox_reputation_snapshots_tier_idx
  on growth.mailbox_reputation_snapshots (health_tier, snapshot_date desc);

create table if not exists growth.mailbox_send_policies (
  id uuid primary key default gen_random_uuid(),
  sender_account_id uuid not null references growth.sender_accounts (id) on delete cascade,
  daily_send_cap integer not null default 50 check (daily_send_cap >= 0),
  hourly_send_cap integer not null default 12 check (hourly_send_cap >= 0),
  minimum_delay_seconds integer not null default 120 check (minimum_delay_seconds >= 0),
  sequence_concurrency_limit integer not null default 3 check (sequence_concurrency_limit >= 0),
  cooldown_hours integer not null default 24 check (cooldown_hours >= 0),
  auto_pause_on_bounce_threshold numeric not null default 8,
  auto_pause_on_complaint_threshold numeric not null default 0.3,
  operator_override boolean not null default false,
  override_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sender_account_id)
);

create table if not exists growth.deliverability_governance_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null
    check (event_type in (
      'mailbox_paused',
      'mailbox_recovered',
      'bounce_threshold_triggered',
      'complaint_threshold_triggered',
      'send_throttle_applied',
      'warmup_stage_changed',
      'deliverability_risk_detected',
      'reputation_recovered'
    )),
  sender_account_id uuid references growth.sender_accounts (id) on delete set null,
  mailbox_connection_id uuid references growth.mailbox_connections (id) on delete set null,
  title text not null,
  summary text not null,
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high', 'critical')),
  reversible boolean not null default true,
  operator_override boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists deliverability_governance_events_created_idx
  on growth.deliverability_governance_events (created_at desc);

create index if not exists deliverability_governance_events_sender_idx
  on growth.deliverability_governance_events (sender_account_id, created_at desc);

comment on table growth.mailbox_reputation_snapshots is
  'Deterministic mailbox reputation metrics and health tiers for internal operator deliverability protection.';

comment on table growth.mailbox_send_policies is
  'Per-mailbox send caps, throttles, and auto-pause thresholds — operator override required for exceptions.';

comment on table growth.deliverability_governance_events is
  'Auditable deliverability governance timeline — pause, throttle, warmup, and recovery events.';

revoke all on table growth.mailbox_reputation_snapshots from public, anon, authenticated;
revoke all on table growth.mailbox_send_policies from public, anon, authenticated;
revoke all on table growth.deliverability_governance_events from public, anon, authenticated;

grant select, insert, update, delete on table growth.mailbox_reputation_snapshots to service_role;
grant select, insert, update, delete on table growth.mailbox_send_policies to service_role;
grant select, insert, update, delete on table growth.deliverability_governance_events to service_role;

alter table growth.mailbox_reputation_snapshots enable row level security;
alter table growth.mailbox_send_policies enable row level security;
alter table growth.deliverability_governance_events enable row level security;

alter table growth.mailbox_reputation_snapshots force row level security;
alter table growth.mailbox_send_policies force row level security;
alter table growth.deliverability_governance_events force row level security;

create policy growth_mailbox_reputation_snapshots_service_role
  on growth.mailbox_reputation_snapshots for all to service_role using (true) with check (true);

create policy growth_mailbox_send_policies_service_role
  on growth.mailbox_send_policies for all to service_role using (true) with check (true);

create policy growth_deliverability_governance_events_service_role
  on growth.deliverability_governance_events for all to service_role using (true) with check (true);
