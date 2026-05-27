-- Growth Engine Phase 4: Outbound lifecycle operations + infrastructure sustainability.

alter table growth.sender_accounts
  add column if not exists lifecycle_stage text not null default 'provisioning'
    check (lifecycle_stage in ('provisioning', 'warming', 'active', 'elevated_risk', 'cooling_down', 'paused', 'retired')),
  add column if not exists lifecycle_stage_override boolean not null default false,
  add column if not exists lifecycle_stage_note text,
  add column if not exists provisioned_at timestamptz,
  add column if not exists infrastructure_tag text,
  add column if not exists operational_owner text;

alter table growth.mailbox_connections
  add column if not exists lifecycle_stage text not null default 'provisioning'
    check (lifecycle_stage in ('provisioning', 'warming', 'active', 'elevated_risk', 'cooling_down', 'paused', 'retired')),
  add column if not exists lifecycle_stage_override boolean not null default false;

create table if not exists growth.inbox_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  sender_account_id uuid references growth.sender_accounts(id) on delete cascade,
  mailbox_connection_id uuid references growth.mailbox_connections(id) on delete set null,
  from_stage text,
  to_stage text not null,
  transition_reason text not null,
  operator_override boolean not null default false,
  actor_user_id text,
  actor_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists inbox_lifecycle_events_sender_idx
  on growth.inbox_lifecycle_events (sender_account_id, created_at desc);

create table if not exists growth.maintenance_tasks (
  id uuid primary key default gen_random_uuid(),
  task_type text not null,
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high', 'critical')),
  title text not null,
  summary text,
  status text not null default 'open'
    check (status in ('open', 'acknowledged', 'resolved', 'dismissed')),
  sender_account_id uuid references growth.sender_accounts(id) on delete set null,
  mailbox_connection_id uuid references growth.mailbox_connections(id) on delete set null,
  sender_domain_id uuid references growth.sender_domains(id) on delete set null,
  sender_pool_id uuid references growth.sender_pools(id) on delete set null,
  recommendation_only boolean not null default true,
  acknowledged_at timestamptz,
  acknowledged_by text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists maintenance_tasks_status_created_idx
  on growth.maintenance_tasks (status, created_at desc);

create table if not exists growth.operational_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_category text not null,
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high', 'critical')),
  title text not null,
  summary text,
  dedupe_key text not null,
  acknowledged boolean not null default false,
  acknowledged_at timestamptz,
  acknowledged_by text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (dedupe_key)
);

create index if not exists operational_alerts_created_idx
  on growth.operational_alerts (created_at desc);

create table if not exists growth.infrastructure_fit_assessments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid,
  sequence_enrollment_id uuid,
  sender_pool_id uuid references growth.sender_pools(id) on delete set null,
  infrastructure_fit_score integer not null default 0
    check (infrastructure_fit_score >= 0 and infrastructure_fit_score <= 100),
  launch_readiness_score integer not null default 0
    check (launch_readiness_score >= 0 and launch_readiness_score <= 100),
  recommendations jsonb not null default '[]'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists growth.operational_analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null default (timezone('utc', now()))::date,
  metric_key text not null,
  metric_value numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (snapshot_date, metric_key)
);

comment on table growth.maintenance_tasks is
  'Operator maintenance recommendations — no autonomous infrastructure mutation.';

comment on table growth.operational_alerts is
  'Deterministic platform-admin operational alerts — optional Slack/email dispatch.';
