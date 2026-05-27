-- Growth Engine Phase 3: Reputation-safe scaling + controlled outbound execution.

alter table growth.sender_domains
  add column if not exists domain_segment text not null default 'primary'
    check (domain_segment in ('primary', 'secondary', 'experimental', 'warming', 'paused', 'high_trust'));

create table if not exists growth.outbound_scheduler_decisions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('outreach_queue', 'sequence_job', 'campaign')),
  entity_id uuid not null,
  decision text not null check (decision in ('execute', 'defer', 'skip', 'throttle', 'redistribute')),
  reasons jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists outbound_scheduler_decisions_created_idx
  on growth.outbound_scheduler_decisions (created_at desc);

create table if not exists growth.throughput_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null default (timezone('utc', now()))::date,
  entity_type text not null check (entity_type in ('domain', 'mailbox', 'pool', 'platform')),
  entity_id uuid,
  entity_label text,
  daily_limit integer not null default 0,
  daily_used integer not null default 0,
  utilization_pct numeric not null default 0,
  queue_congestion integer not null default 0,
  saturation_level text not null default 'normal'
    check (saturation_level in ('low', 'normal', 'elevated', 'critical')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (snapshot_date, entity_type, entity_id)
);

create table if not exists growth.campaign_engagement_metrics (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid,
  sequence_enrollment_id uuid,
  sender_account_id uuid references growth.sender_accounts(id) on delete set null,
  positive_replies integer not null default 0,
  neutral_replies integer not null default 0,
  negative_replies integer not null default 0,
  unsubscribe_intents integer not null default 0,
  complaint_signals integer not null default 0,
  reply_quality_score integer not null default 100
    check (reply_quality_score >= 0 and reply_quality_score <= 100),
  engagement_decay_score integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  snapshot_date date not null default (timezone('utc', now()))::date,
  updated_at timestamptz not null default now(),
  unique (snapshot_date, sequence_enrollment_id, sender_account_id)
);

create table if not exists growth.sequence_execution_diagnostics (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references growth.sequence_execution_jobs(id) on delete cascade,
  diagnostic_type text not null
    check (diagnostic_type in ('stuck', 'dead_letter', 'retry_visible', 'duplicate_risk')),
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high', 'critical')),
  title text not null,
  summary text,
  resolved boolean not null default false,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sequence_execution_diagnostics_job_idx
  on growth.sequence_execution_diagnostics (job_id, created_at desc);

create table if not exists growth.deliverability_trend_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null default (timezone('utc', now()))::date,
  scope_type text not null check (scope_type in ('domain', 'sender', 'pool', 'campaign', 'platform')),
  scope_id uuid,
  scope_label text,
  bounce_rate numeric,
  complaint_rate numeric,
  rejection_rate numeric,
  reply_quality_avg numeric,
  anomaly_detected boolean not null default false,
  anomaly_reasons jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (snapshot_date, scope_type, scope_id)
);

create table if not exists growth.campaign_launch_checks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid,
  sequence_enrollment_id uuid,
  sender_pool_id uuid references growth.sender_pools(id) on delete set null,
  domain_segment text,
  readiness_status text not null default 'blocked'
    check (readiness_status in ('ready', 'degraded', 'blocked')),
  checklist jsonb not null default '[]'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  operator_override boolean not null default false,
  operator_override_reason text,
  actor_user_id text,
  created_at timestamptz not null default now()
);

create index if not exists campaign_launch_checks_created_idx
  on growth.campaign_launch_checks (created_at desc);

comment on table growth.outbound_scheduler_decisions is
  'Deterministic reputation-safe scheduling decisions — audited, no autonomous limit increases.';
