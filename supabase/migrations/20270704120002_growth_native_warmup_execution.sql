-- Growth Engine Phase 6.31A — Native mailbox warmup execution (capacity + lifecycle; no peer warmup bots).
-- Renamed from 20270704120000_* to 20270704120002_* (runs after multi_channel + sms_reply_ingestion).
-- If a failed partial apply left draft/completed statuses migrated, re-run is safe (updates are idempotent).

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

-- Platform timeline: append warmup_stage_changed + warmup_throttled (preserve full list from 20270427120000).
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
    'warmup_stage_changed', 'warmup_throttled',
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
    'deliverability_remediation_task_created',
    'content_template_created', 'content_template_submitted', 'content_template_approved',
    'content_template_rejected', 'content_snippet_approved', 'content_render_previewed',
    'lead_memory_recorded', 'lead_memory_rebuilt', 'relationship_stage_changed',
    'objection_memory_recorded', 'preference_memory_recorded', 'committee_context_recorded',
    'governance_policy_created', 'governance_policy_activated', 'governance_policy_paused',
    'governance_policy_violation', 'governance_approval_audited',
    'governance_export_requested', 'governance_export_completed',
    'governance_retention_updated', 'governance_legal_hold_applied',
    'personalization_generated', 'personalization_approved', 'personalization_rejected',
    'personalization_blocked', 'personalization_sent', 'personalization_feedback_recorded'
  ));
