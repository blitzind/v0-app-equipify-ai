-- Growth Engine Phase 7 — Multi-channel revenue execution intelligence.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Unified multi-channel activity timeline
-- -----------------------------------------------------------------------------

create table if not exists growth.multi_channel_activity_timeline_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  channel text not null
    check (channel in ('email', 'call', 'sms', 'linkedin', 'meeting', 'website', 'note', 'opportunity', 'cadence', 'other')),
  event_kind text not null,
  event_source text not null,
  title text not null,
  summary text not null,
  evidence_excerpt text,
  occurred_at timestamptz not null,
  attribution_type text,
  outbound_reply_id uuid references growth.outbound_replies (id) on delete set null,
  meeting_id uuid references growth.meetings (id) on delete set null,
  call_session_id uuid,
  cadence_task_id uuid,
  channel_task_id uuid,
  intent_session_id uuid,
  payload jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-multichannel-revenue-intelligence-v1',
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_multichannel_timeline_lead_occurred
  on growth.multi_channel_activity_timeline_events (lead_id, occurred_at desc);

create index if not exists idx_growth_multichannel_timeline_channel
  on growth.multi_channel_activity_timeline_events (channel, occurred_at desc);

-- -----------------------------------------------------------------------------
-- Channel effectiveness snapshots
-- -----------------------------------------------------------------------------

create table if not exists growth.channel_effectiveness_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  channel text not null
    check (channel in ('email', 'call', 'sms', 'linkedin', 'meeting', 'website', 'cadence', 'sequence')),
  scope_type text not null default 'global'
    check (scope_type in ('global', 'operator', 'campaign', 'sequence')),
  scope_id uuid,
  touch_count int not null default 0,
  positive_outcomes int not null default 0,
  meetings_booked int not null default 0,
  meetings_attended int not null default 0,
  replies_received int not null default 0,
  effectiveness_score numeric not null default 0,
  attribution_weight numeric not null default 1,
  metrics jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-multichannel-revenue-intelligence-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_channel_effectiveness_date
  on growth.channel_effectiveness_snapshots (snapshot_date desc, channel);

-- -----------------------------------------------------------------------------
-- Website intent correlation snapshots
-- -----------------------------------------------------------------------------

create table if not exists growth.website_intent_correlation_snapshots (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  snapshot_date date not null,
  pageview_count int not null default 0,
  identified_visits int not null default 0,
  outbound_activity_count int not null default 0,
  reply_count int not null default 0,
  meeting_count int not null default 0,
  momentum_score numeric,
  correlation_strength text not null default 'unknown'
    check (correlation_strength in ('unknown', 'weak', 'moderate', 'strong')),
  evidence jsonb not null default '[]'::jsonb,
  qa_marker text not null default 'growth-multichannel-revenue-intelligence-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_growth_website_intent_correlation_lead_date
  on growth.website_intent_correlation_snapshots (lead_id, snapshot_date);

-- -----------------------------------------------------------------------------
-- Extend buying momentum for multi-channel inputs
-- -----------------------------------------------------------------------------

alter table growth.buying_momentum_snapshots
  add column if not exists call_engagement_score numeric not null default 0,
  add column if not exists meeting_engagement_score numeric not null default 0,
  add column if not exists sms_responsiveness_score numeric not null default 0,
  add column if not exists channel_diversity_score numeric not null default 0,
  add column if not exists engagement_consistency_score numeric not null default 0,
  add column if not exists channel_mix jsonb not null default '{}'::jsonb;

-- -----------------------------------------------------------------------------
-- Lead timeline extensions
-- -----------------------------------------------------------------------------

alter table growth.lead_timeline_events
  drop constraint if exists lead_timeline_events_event_type_check;

alter table growth.lead_timeline_events
  add constraint lead_timeline_events_event_type_check check (event_type in (
    'lead_created', 'research_started', 'research_completed', 'research_failed',
    'website_fetch_failed', 'website_fetch_fixed',
    'decision_maker_added', 'decision_maker_confirmed', 'decision_maker_rejected',
    'call_started', 'call_attempted', 'voicemail_left', 'interested',
    'follow_up_created', 'follow_up_completed',
    'notes_updated', 'priority_changed', 'override_changed', 'next_best_action_changed',
    'website_changed', 'status_changed', 'import_created', 'import_updated', 'manual_touch',
    'email_sent', 'email_delivered', 'email_opened', 'email_clicked', 'email_replied',
    'email_bounced', 'email_unsubscribed', 'email_failed', 'email_spam_complaint',
    'email_suppressed', 'email_unmatched',
    'engagement_score_changed', 'engagement_tier_changed', 'lead_became_hot', 'lead_became_dormant',
    'engagement_increased', 'high_engagement_detected',
    'bounce_detected', 'hard_bounce_detected', 'unsubscribe_detected', 'complaint_detected',
    'suppression_applied', 'sender_reputation_declined',
    'provider_event_received', 'provider_delivery_confirmed', 'provider_delivery_failed',
    'provider_bounce_received', 'provider_complaint_received', 'provider_unsubscribe_received',
    'webhook_signature_failed',
    'relationship_strength_changed', 'relationship_became_trusted', 'relationship_became_strategic',
    'relationship_cooled',
    'opportunity_readiness_changed', 'lead_became_sales_ready', 'lead_became_priority_opportunity',
    'opportunity_blocker_added', 'opportunity_blocker_resolved',
    'revenue_probability_changed', 'lead_became_forecasted', 'lead_became_commit_candidate',
    'forecast_confidence_changed', 'forecast_regression_detected',
    'executive_priority_changed', 'executive_intervention_recommended',
    'operational_capacity_changed', 'capacity_constraint_added', 'capacity_constraint_resolved',
    'operational_risk_detected',
    'ai_copilot_generation_created', 'ai_copilot_generation_approved',
    'playbook_conflict_detected',
    'call_copilot_session_started', 'call_copilot_objection_captured',
    'call_copilot_session_completed', 'call_copilot_summary_approved',
    'outreach_queued', 'outreach_approved', 'outreach_executed', 'outreach_failed', 'outreach_cancelled',
    'conversation_health_changed', 'buying_intent_detected', 'competitor_detected',
    'urgency_detected', 'conversation_risk_detected',
    'sequence_pattern_detected', 'sequence_recommendation_changed',
    'sequence_enrollment_created', 'sequence_step_created', 'sequence_step_queued',
    'sequence_step_executed', 'sequence_enrollment_completed', 'sequence_enrollment_cancelled',
    'sequence_step_due', 'sequence_step_skipped', 'sequence_scheduler_run',
    'sequence_step_scheduled', 'sequence_step_approved', 'sequence_step_blocked',
    'sequence_step_sent', 'sequence_step_failed',
    'lead_assigned', 'lead_reassigned', 'lead_unassigned', 'assignment_rule_applied', 'assignment_skipped',
    'notification_created', 'notification_acknowledged', 'notification_completed', 'notification_expired',
    'live_call_started', 'buying_signal_detected', 'objection_detected', 'discovery_gap_detected',
    'call_risk_detected', 'live_call_completed', 'live_guidance_generated', 'live_guidance_used',
    'opportunity_created', 'stage_changed', 'forecast_changed', 'owner_changed', 'amount_changed',
    'stale_detected', 'opportunity_closed_won', 'opportunity_closed_lost',
    'reply_received', 'reply_classified', 'reply_assigned', 'reply_overdue', 'meeting_requested',
    'reply_buying_signal_detected', 'reply_objection_detected', 'reply_workflow_routed',
    'reply_suppression_applied', 'reply_copilot_assisted', 'reply_ingested',
    'buying_momentum_updated', 'opportunity_signal_timeline_recorded', 'revenue_intelligence_copilot_assisted',
    'multichannel_activity_recorded', 'channel_effectiveness_updated', 'website_intent_correlated',
    'multichannel_copilot_assisted',
    'meeting_created', 'meeting_scheduled', 'meeting_completed', 'meeting_no_show', 'meeting_canceled',
    'meeting_followup_due', 'meeting_outcome_recorded',
    'cadence_task_created', 'cadence_task_due', 'cadence_task_completed', 'cadence_task_skipped',
    'cadence_step_completed', 'cadence_step_skipped',
    'customer_created', 'onboarding_started', 'onboarding_completed', 'activation_recorded',
    'review_requested', 'review_received', 'referral_requested', 'referral_received',
    'renewal_window_opened', 'renewal_due', 'expansion_candidate_detected', 'churn_risk_detected',
    'inbox_sync_started', 'inbox_sync_completed', 'inbox_reply_imported',
    'inbox_thread_matched', 'inbox_thread_created', 'inbox_duplicate_skipped',
    'reply_draft_generated', 'reply_draft_approved', 'reply_draft_discarded',
    'reply_draft_sent', 'reply_draft_blocked'
  ));

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.multi_channel_activity_timeline_events from public, anon, authenticated;
revoke all on table growth.channel_effectiveness_snapshots from public, anon, authenticated;
revoke all on table growth.website_intent_correlation_snapshots from public, anon, authenticated;

grant select, insert, update, delete on table growth.multi_channel_activity_timeline_events to service_role;
grant select, insert, update, delete on table growth.channel_effectiveness_snapshots to service_role;
grant select, insert, update, delete on table growth.website_intent_correlation_snapshots to service_role;

alter table growth.multi_channel_activity_timeline_events enable row level security;
alter table growth.channel_effectiveness_snapshots enable row level security;
alter table growth.website_intent_correlation_snapshots enable row level security;

alter table growth.multi_channel_activity_timeline_events force row level security;
alter table growth.channel_effectiveness_snapshots force row level security;
alter table growth.website_intent_correlation_snapshots force row level security;
