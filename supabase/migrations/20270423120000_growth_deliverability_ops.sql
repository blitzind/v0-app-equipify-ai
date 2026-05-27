-- Growth Engine Phase 2R — Deliverability Operations Center + Reputation Recommendations.
-- Advisory-only recommendations — no autonomous DNS, sender, volume, or provider mutations.

do $$
begin
  if to_regclass('growth.sender_accounts') is null then
    raise exception 'Missing dependency: growth.sender_accounts';
  end if;
  if to_regclass('growth.sender_domains') is null then
    raise exception 'Missing dependency: growth.sender_domains';
  end if;
  if to_regclass('growth.deliverability_snapshots') is null then
    raise exception 'Missing dependency: growth.deliverability_snapshots';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.deliverability_ops_snapshots
-- -----------------------------------------------------------------------------

create table if not exists growth.deliverability_ops_snapshots (
  id uuid primary key default gen_random_uuid(),
  overall_score numeric not null default 0 check (overall_score >= 0 and overall_score <= 100),
  sender_reputation_score numeric not null default 0 check (sender_reputation_score >= 0 and sender_reputation_score <= 100),
  domain_health_score numeric not null default 0 check (domain_health_score >= 0 and domain_health_score <= 100),
  provider_health_score numeric not null default 0 check (provider_health_score >= 0 and provider_health_score <= 100),
  compliance_risk_score numeric not null default 0 check (compliance_risk_score >= 0 and compliance_risk_score <= 100),
  warmup_health_score numeric not null default 0 check (warmup_health_score >= 0 and warmup_health_score <= 100),
  volume_pressure_score numeric not null default 0 check (volume_pressure_score >= 0 and volume_pressure_score <= 100),
  open_risk_alerts integer not null default 0 check (open_risk_alerts >= 0),
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_deliverability_ops_snapshots_recorded
  on growth.deliverability_ops_snapshots (recorded_at desc);

comment on table growth.deliverability_ops_snapshots is
  'Periodic deliverability ops health snapshots — no secrets or raw provider payloads.';

-- -----------------------------------------------------------------------------
-- growth.deliverability_recommendations
-- -----------------------------------------------------------------------------

create table if not exists growth.deliverability_recommendations (
  id uuid primary key default gen_random_uuid(),
  recommendation_type text not null
    check (recommendation_type in (
      'pause_sender', 'reduce_volume', 'rotate_sender', 'increase_warmup',
      'fix_spf', 'fix_dkim', 'fix_dmarc', 'review_copy', 'review_targeting',
      'switch_provider_route', 'suppress_bad_leads', 'investigate_domain'
    )),
  status text not null default 'open'
    check (status in ('open', 'acknowledged', 'in_progress', 'completed', 'dismissed')),
  title text not null default '',
  description text not null default '',
  evidence jsonb not null default '[]'::jsonb,
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high', 'critical')),
  entity_type text not null default 'platform'
    check (entity_type in ('platform', 'sender', 'domain', 'provider', 'pool', 'route')),
  entity_id uuid,
  entity_label text not null default '',
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  completed_by uuid,
  completed_at timestamptz,
  dismissed_by uuid,
  dismissed_at timestamptz,
  dismiss_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_deliverability_recommendations_status
  on growth.deliverability_recommendations (status, severity, created_at desc);

create index if not exists idx_growth_deliverability_recommendations_type
  on growth.deliverability_recommendations (recommendation_type, created_at desc);

comment on table growth.deliverability_recommendations is
  'Human-gated deliverability recommendations — advisory only, evidence required, no auto-execution.';

-- -----------------------------------------------------------------------------
-- growth.deliverability_risk_events
-- -----------------------------------------------------------------------------

create table if not exists growth.deliverability_risk_events (
  id uuid primary key default gen_random_uuid(),
  risk_type text not null
    check (risk_type in (
      'spf_failure', 'dkim_failure', 'dmarc_failure', 'bounce_spike', 'complaint_spike',
      'unsubscribe_spike', 'open_rate_drop', 'click_rate_drop', 'reply_rate_drop',
      'sender_fatigue', 'warmup_mismatch', 'provider_degradation', 'domain_reputation_drop',
      'rate_limit_pressure'
    )),
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high', 'critical')),
  title text not null default '',
  description text not null default '',
  entity_type text not null default 'platform'
    check (entity_type in ('platform', 'sender', 'domain', 'provider', 'pool', 'route')),
  entity_id uuid,
  entity_label text not null default '',
  signals jsonb not null default '{}'::jsonb,
  resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_deliverability_risk_events_open
  on growth.deliverability_risk_events (resolved, severity, created_at desc);

create index if not exists idx_growth_deliverability_risk_events_type
  on growth.deliverability_risk_events (risk_type, created_at desc);

comment on table growth.deliverability_risk_events is
  'Deliverability risk detections — signals only, no autonomous remediation.';

-- -----------------------------------------------------------------------------
-- growth.deliverability_remediation_tasks
-- -----------------------------------------------------------------------------

create table if not exists growth.deliverability_remediation_tasks (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid references growth.deliverability_recommendations (id) on delete set null,
  risk_event_id uuid references growth.deliverability_risk_events (id) on delete set null,
  task_type text not null default 'operational_checklist',
  status text not null default 'open'
    check (status in ('open', 'acknowledged', 'in_progress', 'completed', 'dismissed')),
  title text not null default '',
  description text not null default '',
  checklist jsonb not null default '[]'::jsonb,
  entity_type text not null default 'platform'
    check (entity_type in ('platform', 'sender', 'domain', 'provider', 'pool', 'route')),
  entity_label text not null default '',
  assigned_to uuid,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_deliverability_remediation_tasks_status
  on growth.deliverability_remediation_tasks (status, created_at desc);

comment on table growth.deliverability_remediation_tasks is
  'Operational remediation checklist items — human completion only.';

-- -----------------------------------------------------------------------------
-- growth.deliverability_domain_reputation_history
-- -----------------------------------------------------------------------------

create table if not exists growth.deliverability_domain_reputation_history (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid references growth.sender_domains (id) on delete set null,
  domain_label text not null default '',
  reputation_score numeric not null default 0 check (reputation_score >= 0 and reputation_score <= 100),
  bounce_rate numeric not null default 0 check (bounce_rate >= 0),
  complaint_rate numeric not null default 0 check (complaint_rate >= 0),
  authentication_score numeric not null default 0 check (authentication_score >= 0 and authentication_score <= 100),
  trend text not null default 'stable'
    check (trend in ('stable', 'improving', 'declining')),
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_deliverability_domain_reputation_domain
  on growth.deliverability_domain_reputation_history (domain_id, recorded_at desc);

comment on table growth.deliverability_domain_reputation_history is
  'Domain reputation trend history — masked labels, no DNS credentials.';

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
    'performance_risk_detected', 'performance_trend_detected',
    'opportunity_signal_detected', 'opportunity_recommendation_created',
    'opportunity_recommendation_accepted', 'opportunity_recommendation_dismissed',
    'committee_signal_detected', 'sequence_pause_candidate_detected',
    'booking_intent_detected', 'booking_recommendation_created',
    'booking_recommendation_approved', 'booking_recommendation_dismissed',
    'booking_recommendation_completed', 'meeting_conversion_recorded',
    'sequence_meeting_exit_candidate_detected',
    'channel_task_planned', 'channel_task_approved', 'channel_task_completed',
    'channel_task_skipped', 'channel_task_blocked', 'channel_performance_recorded',
    'sender_pool_created', 'sender_pool_rotated', 'sender_fatigue_detected', 'sender_pool_member_cooldown',
    'deliverability_ops_snapshot_recorded', 'deliverability_risk_detected',
    'deliverability_recommendation_created', 'deliverability_recommendation_acknowledged',
    'deliverability_recommendation_completed', 'deliverability_recommendation_dismissed',
    'deliverability_remediation_task_created'
  ));

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.deliverability_ops_snapshots from public, anon, authenticated;
revoke all on table growth.deliverability_recommendations from public, anon, authenticated;
revoke all on table growth.deliverability_risk_events from public, anon, authenticated;
revoke all on table growth.deliverability_remediation_tasks from public, anon, authenticated;
revoke all on table growth.deliverability_domain_reputation_history from public, anon, authenticated;

grant select, insert, update, delete on table growth.deliverability_ops_snapshots to service_role;
grant select, insert, update, delete on table growth.deliverability_recommendations to service_role;
grant select, insert, update, delete on table growth.deliverability_risk_events to service_role;
grant select, insert, update, delete on table growth.deliverability_remediation_tasks to service_role;
grant select, insert, update, delete on table growth.deliverability_domain_reputation_history to service_role;

alter table growth.deliverability_ops_snapshots enable row level security;
alter table growth.deliverability_recommendations enable row level security;
alter table growth.deliverability_risk_events enable row level security;
alter table growth.deliverability_remediation_tasks enable row level security;
alter table growth.deliverability_domain_reputation_history enable row level security;

alter table growth.deliverability_ops_snapshots force row level security;
alter table growth.deliverability_recommendations force row level security;
alter table growth.deliverability_risk_events force row level security;
alter table growth.deliverability_remediation_tasks force row level security;
alter table growth.deliverability_domain_reputation_history force row level security;

create policy growth_deliverability_ops_snapshots_service_role
  on growth.deliverability_ops_snapshots for all to service_role using (true) with check (true);

create policy growth_deliverability_recommendations_service_role
  on growth.deliverability_recommendations for all to service_role using (true) with check (true);

create policy growth_deliverability_risk_events_service_role
  on growth.deliverability_risk_events for all to service_role using (true) with check (true);

create policy growth_deliverability_remediation_tasks_service_role
  on growth.deliverability_remediation_tasks for all to service_role using (true) with check (true);

create policy growth_deliverability_domain_reputation_history_service_role
  on growth.deliverability_domain_reputation_history for all to service_role using (true) with check (true);
