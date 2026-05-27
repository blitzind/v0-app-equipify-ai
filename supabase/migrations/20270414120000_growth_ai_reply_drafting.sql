-- Growth Engine Phase 2J — AI reply drafting + human review.
-- Growth owns context, draft generation, approval, compliance guardrails, audit.
-- Providers transport approved replies only. No autonomous send.

do $$
begin
  if to_regclass('growth.inbox_threads') is null then
    raise exception 'Missing dependency: growth.inbox_threads';
  end if;
  if to_regclass('growth.inbox_messages') is null then
    raise exception 'Missing dependency: growth.inbox_messages';
  end if;
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
  if to_regclass('growth.delivery_attempts') is null then
    raise exception 'Missing dependency: growth.delivery_attempts';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.inbox_reply_drafts
-- -----------------------------------------------------------------------------

create table if not exists growth.inbox_reply_drafts (
  id uuid primary key default gen_random_uuid(),
  inbox_thread_id uuid not null references growth.inbox_threads (id) on delete cascade,
  inbox_message_id uuid references growth.inbox_messages (id) on delete set null,
  lead_id uuid references growth.leads (id) on delete set null,
  sequence_enrollment_id uuid references growth.sequence_enrollments (id) on delete set null,
  ai_generation_id uuid references growth.ai_copilot_generations (id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'discarded', 'sent', 'blocked')),
  draft_subject text,
  draft_body text not null default '',
  classification text,
  tone text not null default 'professional',
  confidence integer not null default 0 check (confidence >= 0 and confidence <= 100),
  risk_level text not null default 'medium'
    check (risk_level in ('low', 'medium', 'high', 'blocked')),
  requires_human_review boolean not null default true,
  approved_at timestamptz,
  approved_by uuid,
  discarded_at timestamptz,
  discarded_by uuid,
  sent_delivery_attempt_id uuid references growth.delivery_attempts (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_inbox_reply_drafts_thread
  on growth.inbox_reply_drafts (inbox_thread_id);

create index if not exists idx_growth_inbox_reply_drafts_lead
  on growth.inbox_reply_drafts (lead_id);

create index if not exists idx_growth_inbox_reply_drafts_status
  on growth.inbox_reply_drafts (status);

create index if not exists idx_growth_inbox_reply_drafts_created
  on growth.inbox_reply_drafts (created_at desc);

comment on table growth.inbox_reply_drafts is
  'Human-reviewed AI reply drafts — approval required before transport send.';

-- -----------------------------------------------------------------------------
-- growth.inbox_reply_draft_events
-- -----------------------------------------------------------------------------

create table if not exists growth.inbox_reply_draft_events (
  id uuid primary key default gen_random_uuid(),
  reply_draft_id uuid not null references growth.inbox_reply_drafts (id) on delete cascade,
  event_type text not null,
  severity text not null default 'info'
    check (severity in ('info', 'low', 'medium', 'high', 'critical')),
  title text not null default '',
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_inbox_reply_draft_events_draft
  on growth.inbox_reply_draft_events (reply_draft_id);

create index if not exists idx_growth_inbox_reply_draft_events_created
  on growth.inbox_reply_draft_events (created_at desc);

comment on table growth.inbox_reply_draft_events is
  'Audit trail for inbox reply draft lifecycle events.';

-- -----------------------------------------------------------------------------
-- Extend platform timeline for reply draft events
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
    'rate_limit_hit',
    'inbox_sync_started',
    'inbox_sync_completed',
    'inbox_reply_imported',
    'inbox_thread_matched',
    'inbox_thread_created',
    'inbox_duplicate_skipped',
    'reply_draft_generated',
    'reply_draft_approved',
    'reply_draft_discarded',
    'reply_draft_sent',
    'reply_draft_blocked'
  ));

-- -----------------------------------------------------------------------------
-- Extend lead timeline for reply draft events
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

revoke all on table growth.inbox_reply_drafts from public, anon, authenticated;
revoke all on table growth.inbox_reply_draft_events from public, anon, authenticated;

grant select, insert, update, delete on table growth.inbox_reply_drafts to service_role;
grant select, insert, update, delete on table growth.inbox_reply_draft_events to service_role;

alter table growth.inbox_reply_drafts enable row level security;
alter table growth.inbox_reply_draft_events enable row level security;

alter table growth.inbox_reply_drafts force row level security;
alter table growth.inbox_reply_draft_events force row level security;

create policy growth_inbox_reply_drafts_service_role
  on growth.inbox_reply_drafts for all to service_role using (true) with check (true);

create policy growth_inbox_reply_draft_events_service_role
  on growth.inbox_reply_draft_events for all to service_role using (true) with check (true);
