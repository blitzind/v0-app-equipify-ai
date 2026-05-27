-- Growth Engine Phase 2M — Sequence performance + revenue intelligence.
-- Telemetry → operator intelligence. No autonomous optimization or promotion.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
  if to_regclass('growth.delivery_attempts') is null then
    raise exception 'Missing dependency: growth.delivery_attempts';
  end if;
  if to_regclass('growth.sequence_enrollments') is null then
    raise exception 'Missing dependency: growth.sequence_enrollments';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.sequence_performance_snapshots
-- -----------------------------------------------------------------------------

create table if not exists growth.sequence_performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid,
  sequence_enrollment_id uuid,
  period_key text not null default '30d'
    check (period_key in ('7d', '30d', '90d', 'all')),
  metrics jsonb not null default '{}'::jsonb,
  trend text not null default 'stable'
    check (trend in ('improving', 'stable', 'declining', 'critical')),
  snapshot_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_sequence_performance_snapshots_sequence
  on growth.sequence_performance_snapshots (sequence_id, period_key, snapshot_at desc);

create index if not exists idx_growth_sequence_performance_snapshots_enrollment
  on growth.sequence_performance_snapshots (sequence_enrollment_id, snapshot_at desc);

comment on table growth.sequence_performance_snapshots is
  'Rolling sequence performance metrics — read-only operator intelligence.';

-- -----------------------------------------------------------------------------
-- growth.sender_performance_snapshots
-- -----------------------------------------------------------------------------

create table if not exists growth.sender_performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  sender_account_id uuid not null,
  period_key text not null default '30d'
    check (period_key in ('7d', '30d', '90d', 'all')),
  metrics jsonb not null default '{}'::jsonb,
  trend text not null default 'stable'
    check (trend in ('improving', 'stable', 'declining', 'critical')),
  snapshot_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_sender_performance_snapshots_sender
  on growth.sender_performance_snapshots (sender_account_id, period_key, snapshot_at desc);

comment on table growth.sender_performance_snapshots is
  'Sender deliverability and engagement trend snapshots.';

-- -----------------------------------------------------------------------------
-- growth.provider_route_performance_snapshots
-- -----------------------------------------------------------------------------

create table if not exists growth.provider_route_performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid,
  route_id uuid,
  period_key text not null default '30d'
    check (period_key in ('7d', '30d', '90d', 'all')),
  metrics jsonb not null default '{}'::jsonb,
  trend text not null default 'stable'
    check (trend in ('improving', 'stable', 'declining', 'critical')),
  snapshot_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_provider_route_performance_snapshots_provider
  on growth.provider_route_performance_snapshots (provider_id, period_key, snapshot_at desc);

create index if not exists idx_growth_provider_route_performance_snapshots_route
  on growth.provider_route_performance_snapshots (route_id, period_key, snapshot_at desc);

comment on table growth.provider_route_performance_snapshots is
  'Provider route delivery performance snapshots.';

-- -----------------------------------------------------------------------------
-- growth.revenue_attribution_events
-- -----------------------------------------------------------------------------

create table if not exists growth.revenue_attribution_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  opportunity_id uuid,
  event_type text not null
    check (event_type in (
      'meeting_booked', 'opportunity_created', 'opportunity_won', 'pipeline_value'
    )),
  attribution_type text not null default 'sequence'
    check (attribution_type in (
      'sequence', 'variant', 'sender', 'provider_route', 'reply_draft'
    )),
  sequence_id uuid,
  sequence_enrollment_id uuid,
  experiment_id uuid,
  variant_id uuid,
  sender_account_id uuid,
  provider_id uuid,
  delivery_attempt_id uuid references growth.delivery_attempts (id) on delete set null,
  weighted_amount numeric(14,2) not null default 0,
  revenue_amount numeric(14,2) not null default 0,
  attribution_weight numeric(5,4) not null default 1.0000
    check (attribution_weight >= 0 and attribution_weight <= 1),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_revenue_attribution_events_lead
  on growth.revenue_attribution_events (lead_id, occurred_at desc);

create index if not exists idx_growth_revenue_attribution_events_sequence
  on growth.revenue_attribution_events (sequence_id, occurred_at desc);

create index if not exists idx_growth_revenue_attribution_events_type
  on growth.revenue_attribution_events (event_type, occurred_at desc);

comment on table growth.revenue_attribution_events is
  'Weighted revenue attribution from sequence/sender/variant touchpoints — human review only.';

-- -----------------------------------------------------------------------------
-- growth.performance_intelligence_events
-- -----------------------------------------------------------------------------

create table if not exists growth.performance_intelligence_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null
    check (event_type in (
      'bounce_spike', 'unsubscribe_spike', 'complaint_spike',
      'sender_fatigue', 'provider_degradation', 'meeting_drop',
      'reply_collapse', 'trend_improving', 'trend_declining',
      'snapshot_recorded', 'attribution_recorded'
    )),
  severity text not null default 'info'
    check (severity in ('info', 'low', 'medium', 'high', 'critical')),
  title text not null default '',
  description text not null default '',
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_performance_intelligence_events_type
  on growth.performance_intelligence_events (event_type, created_at desc);

create index if not exists idx_growth_performance_intelligence_events_entity
  on growth.performance_intelligence_events (entity_type, entity_id, created_at desc);

comment on table growth.performance_intelligence_events is
  'Performance intelligence audit and risk alerts — no autonomous actions.';

-- -----------------------------------------------------------------------------
-- Extend platform timeline
-- -----------------------------------------------------------------------------

alter table growth.platform_timeline_events
  drop constraint if exists platform_timeline_events_event_type_check;

alter table growth.platform_timeline_events
  add constraint platform_timeline_events_event_type_check
  check (event_type in (
    'provider_connected', 'provider_validation_failed', 'provider_disabled', 'provider_reconnected',
    'sender_connected', 'sender_disabled', 'sender_score_changed',
    'domain_health_declined', 'domain_validated',
    'mailbox_connected', 'mailbox_disconnected', 'mailbox_validation_failed',
    'mailbox_token_expired', 'mailbox_health_declined',
    'spf_missing', 'dkim_missing', 'dmarc_missing', 'dns_health_declined', 'deliverability_improved',
    'domain_warning_created', 'warmup_started', 'warmup_paused', 'warmup_completed',
    'warmup_health_declined', 'warmup_progress_milestone',
    'sequence_created', 'sequence_started', 'sequence_paused', 'sequence_completed',
    'sequence_cancelled', 'sequence_health_declined',
    'reply_detected', 'positive_interest_detected', 'budget_objection_detected',
    'timeline_objection_detected', 'meeting_interest_detected', 'unsubscribe_detected',
    'thread_owner_assigned', 'thread_claimed', 'thread_handoff', 'thread_unassigned',
    'thread_sla_overdue', 'inbox_assignment_rule_applied',
    'delivery_route_changed', 'fallback_route_triggered',
    'delivery_queued', 'delivery_sent', 'delivery_failed', 'delivery_retry', 'rate_limit_hit',
    'inbox_sync_started', 'inbox_sync_completed', 'inbox_reply_imported',
    'inbox_thread_matched', 'inbox_thread_created', 'inbox_duplicate_skipped',
    'reply_draft_generated', 'reply_draft_approved', 'reply_draft_discarded',
    'reply_draft_sent', 'reply_draft_blocked',
    'experiment_created', 'experiment_started', 'experiment_paused', 'experiment_completed',
    'experiment_winner_recommended', 'experiment_winner_promoted', 'experiment_variant_assigned',
    'performance_snapshot_recorded', 'revenue_attribution_recorded',
    'performance_risk_detected', 'performance_trend_detected'
  ));

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.sequence_performance_snapshots from public, anon, authenticated;
revoke all on table growth.sender_performance_snapshots from public, anon, authenticated;
revoke all on table growth.provider_route_performance_snapshots from public, anon, authenticated;
revoke all on table growth.revenue_attribution_events from public, anon, authenticated;
revoke all on table growth.performance_intelligence_events from public, anon, authenticated;

grant select, insert, update, delete on table growth.sequence_performance_snapshots to service_role;
grant select, insert, update, delete on table growth.sender_performance_snapshots to service_role;
grant select, insert, update, delete on table growth.provider_route_performance_snapshots to service_role;
grant select, insert, update, delete on table growth.revenue_attribution_events to service_role;
grant select, insert, update, delete on table growth.performance_intelligence_events to service_role;

alter table growth.sequence_performance_snapshots enable row level security;
alter table growth.sender_performance_snapshots enable row level security;
alter table growth.provider_route_performance_snapshots enable row level security;
alter table growth.revenue_attribution_events enable row level security;
alter table growth.performance_intelligence_events enable row level security;

alter table growth.sequence_performance_snapshots force row level security;
alter table growth.sender_performance_snapshots force row level security;
alter table growth.provider_route_performance_snapshots force row level security;
alter table growth.revenue_attribution_events force row level security;
alter table growth.performance_intelligence_events force row level security;

create policy growth_sequence_performance_snapshots_service_role
  on growth.sequence_performance_snapshots for all to service_role using (true) with check (true);
create policy growth_sender_performance_snapshots_service_role
  on growth.sender_performance_snapshots for all to service_role using (true) with check (true);
create policy growth_provider_route_performance_snapshots_service_role
  on growth.provider_route_performance_snapshots for all to service_role using (true) with check (true);
create policy growth_revenue_attribution_events_service_role
  on growth.revenue_attribution_events for all to service_role using (true) with check (true);
create policy growth_performance_intelligence_events_service_role
  on growth.performance_intelligence_events for all to service_role using (true) with check (true);
