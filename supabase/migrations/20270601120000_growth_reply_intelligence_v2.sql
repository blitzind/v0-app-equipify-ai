-- Growth Engine Phase 5 — Reply intelligence v2 + conversation-driven sales execution.

do $$
begin
  if to_regclass('growth.outbound_replies') is null then
    raise exception 'Missing dependency: growth.outbound_replies';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Reply ingestion events (canonical pipeline audit trail)
-- -----------------------------------------------------------------------------

create table if not exists growth.reply_ingestion_events (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('provider_webhook', 'google_mailbox_sync', 'tracking_event', 'manual_import')),
  dedupe_key text not null,
  sender_email text,
  recipient_email text,
  subject text,
  body_excerpt text,
  received_at timestamptz not null,
  lead_id uuid references growth.leads (id) on delete set null,
  outbound_reply_id uuid references growth.outbound_replies (id) on delete set null,
  inbox_message_id uuid references growth.inbox_messages (id) on delete set null,
  mailbox_connection_id uuid references growth.mailbox_connections (id) on delete set null,
  campaign_id uuid references growth.outbound_campaigns (id) on delete set null,
  sequence_enrollment_id uuid,
  delivery_attempt_id uuid,
  provider_family text,
  provider_message_id text,
  raw_payload_ref jsonb not null default '{}'::jsonb,
  normalized_payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processed', 'deduped', 'skipped', 'failed')),
  deduped_from_id uuid references growth.reply_ingestion_events (id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_growth_reply_ingestion_dedupe
  on growth.reply_ingestion_events (dedupe_key);

create index if not exists idx_growth_reply_ingestion_lead_received
  on growth.reply_ingestion_events (lead_id, received_at desc)
  where lead_id is not null;

create index if not exists idx_growth_reply_ingestion_outbound_reply
  on growth.reply_ingestion_events (outbound_reply_id)
  where outbound_reply_id is not null;

-- -----------------------------------------------------------------------------
-- Reply workflow actions (auditable operator routing)
-- -----------------------------------------------------------------------------

create table if not exists growth.reply_workflow_actions (
  id uuid primary key default gen_random_uuid(),
  reply_id uuid references growth.outbound_replies (id) on delete cascade,
  ingestion_event_id uuid references growth.reply_ingestion_events (id) on delete set null,
  lead_id uuid references growth.leads (id) on delete cascade,
  action_type text not null,
  action_status text not null default 'recorded'
    check (action_status in ('recorded', 'pending_review', 'approved', 'rejected', 'completed')),
  severity text not null default 'info'
    check (severity in ('info', 'low', 'medium', 'high', 'critical')),
  title text not null,
  summary text not null,
  evidence jsonb not null default '{}'::jsonb,
  actor_user_id uuid references auth.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_reply_workflow_lead_created
  on growth.reply_workflow_actions (lead_id, created_at desc);

create index if not exists idx_growth_reply_workflow_reply
  on growth.reply_workflow_actions (reply_id, created_at desc)
  where reply_id is not null;

-- -----------------------------------------------------------------------------
-- Conversation timeline (unified operator view)
-- -----------------------------------------------------------------------------

create table if not exists growth.conversation_timeline_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  event_kind text not null,
  event_source text not null,
  title text not null,
  summary text not null,
  evidence_excerpt text,
  occurred_at timestamptz not null,
  outbound_reply_id uuid references growth.outbound_replies (id) on delete set null,
  ingestion_event_id uuid references growth.reply_ingestion_events (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  display_rank int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_conversation_timeline_lead_occurred
  on growth.conversation_timeline_events (lead_id, occurred_at desc);

-- -----------------------------------------------------------------------------
-- Campaign reply learning snapshots
-- -----------------------------------------------------------------------------

create table if not exists growth.campaign_reply_learning_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  campaign_id uuid references growth.outbound_campaigns (id) on delete set null,
  sequence_enrollment_id uuid,
  sender_account_id uuid,
  total_replies int not null default 0,
  positive_reply_rate numeric not null default 0,
  objection_rate numeric not null default 0,
  unsubscribe_reply_rate numeric not null default 0,
  wrong_person_rate numeric not null default 0,
  demo_request_rate numeric not null default 0,
  pricing_question_rate numeric not null default 0,
  reply_quality_score numeric not null default 100,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_growth_campaign_reply_learning_snapshot
  on growth.campaign_reply_learning_snapshots (
    snapshot_date,
    coalesce(sequence_enrollment_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(sender_account_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- -----------------------------------------------------------------------------
-- Outbound reply intelligence v2 columns
-- -----------------------------------------------------------------------------

alter table growth.outbound_replies
  add column if not exists classification_v2 jsonb,
  add column if not exists confidence_tier text,
  add column if not exists uncertainty_state text,
  add column if not exists matched_phrases jsonb not null default '[]'::jsonb,
  add column if not exists recommended_operator_action text,
  add column if not exists ingestion_source text,
  add column if not exists ingestion_event_id uuid references growth.reply_ingestion_events (id) on delete set null;

alter table growth.outbound_replies
  drop constraint if exists outbound_replies_intent_check;

alter table growth.outbound_replies
  add constraint outbound_replies_intent_check
  check (
    intent is null
    or intent in (
      'positive_interest',
      'meeting_request',
      'pricing_question',
      'timing_delay',
      'objection',
      'not_interested',
      'unsubscribe',
      'referral',
      'wrong_contact',
      'out_of_office',
      'competitor_mention',
      'support_request',
      'demo_request',
      'neutral_acknowledgement',
      'angry_complaint',
      'needs_more_information',
      'unknown'
    )
  );

alter table growth.outbound_replies
  drop constraint if exists outbound_replies_confidence_tier_check;

alter table growth.outbound_replies
  add constraint outbound_replies_confidence_tier_check
  check (confidence_tier is null or confidence_tier in ('high', 'medium', 'low', 'uncertain'));

alter table growth.outbound_replies
  drop constraint if exists outbound_replies_uncertainty_state_check;

alter table growth.outbound_replies
  add constraint outbound_replies_uncertainty_state_check
  check (uncertainty_state is null or uncertainty_state in ('confident', 'partial', 'ambiguous', 'insufficient_evidence'));

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

revoke all on table growth.reply_ingestion_events from public, anon, authenticated;
revoke all on table growth.reply_workflow_actions from public, anon, authenticated;
revoke all on table growth.conversation_timeline_events from public, anon, authenticated;
revoke all on table growth.campaign_reply_learning_snapshots from public, anon, authenticated;

grant select, insert, update, delete on table growth.reply_ingestion_events to service_role;
grant select, insert, update, delete on table growth.reply_workflow_actions to service_role;
grant select, insert, update, delete on table growth.conversation_timeline_events to service_role;
grant select, insert, update, delete on table growth.campaign_reply_learning_snapshots to service_role;

alter table growth.reply_ingestion_events enable row level security;
alter table growth.reply_workflow_actions enable row level security;
alter table growth.conversation_timeline_events enable row level security;
alter table growth.campaign_reply_learning_snapshots enable row level security;

alter table growth.reply_ingestion_events force row level security;
alter table growth.reply_workflow_actions force row level security;
alter table growth.conversation_timeline_events force row level security;
alter table growth.campaign_reply_learning_snapshots force row level security;
