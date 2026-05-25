-- Growth Engine Slice 6.22A — Reply processing + inbox intelligence hardening.

do $$
begin
  if to_regclass('growth.outbound_replies') is null then
    raise exception 'Missing dependency: growth.outbound_replies';
  end if;
end;
$$;

alter table growth.outbound_replies
  add column if not exists intent text,
  add column if not exists priority text not null default 'low',
  add column if not exists next_action text,
  add column if not exists owner_user_id uuid references auth.users (id) on delete set null,
  add column if not exists thread_reply_count int not null default 1 check (thread_reply_count >= 1),
  add column if not exists first_reply_at timestamptz,
  add column if not exists last_reply_at timestamptz,
  add column if not exists response_latency_ms int check (response_latency_ms is null or response_latency_ms >= 0),
  add column if not exists unanswered boolean not null default true,
  add column if not exists owner_waiting boolean not null default false,
  add column if not exists reply_sla_due_at timestamptz,
  add column if not exists buying_signals jsonb not null default '[]'::jsonb,
  add column if not exists objection_signals jsonb not null default '[]'::jsonb,
  add column if not exists escalation_signals jsonb not null default '[]'::jsonb,
  add column if not exists intelligence_processed_at timestamptz;

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
      'unknown'
    )
  );

alter table growth.outbound_replies
  drop constraint if exists outbound_replies_priority_check;

alter table growth.outbound_replies
  add constraint outbound_replies_priority_check
  check (priority in ('critical', 'high', 'medium', 'low'));

alter table growth.outbound_replies
  drop constraint if exists outbound_replies_next_action_check;

alter table growth.outbound_replies
  add constraint outbound_replies_next_action_check
  check (
    next_action is null
    or next_action in (
      'call_prospect',
      'reply_email',
      'schedule_meeting',
      'update_opportunity',
      'follow_up_later',
      'verify_contact',
      'manual_review'
    )
  );

create index if not exists idx_growth_outbound_replies_owner_received
  on growth.outbound_replies (owner_user_id, received_at desc);

create index if not exists idx_growth_outbound_replies_priority_received
  on growth.outbound_replies (priority, received_at desc);

create index if not exists idx_growth_outbound_replies_intent_received
  on growth.outbound_replies (intent, received_at desc)
  where intent is not null;

create index if not exists idx_growth_outbound_replies_unanswered
  on growth.outbound_replies (unanswered, received_at desc)
  where unanswered = true;

create index if not exists idx_growth_outbound_replies_sla_due
  on growth.outbound_replies (reply_sla_due_at asc)
  where reply_sla_due_at is not null;

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
    'lead_assigned', 'lead_reassigned', 'lead_unassigned', 'assignment_rule_applied', 'assignment_skipped',
    'notification_created', 'notification_acknowledged', 'notification_completed', 'notification_expired',
    'live_call_started', 'buying_signal_detected', 'objection_detected', 'discovery_gap_detected',
    'call_risk_detected', 'live_call_completed', 'live_guidance_generated', 'live_guidance_used',
    'opportunity_created', 'stage_changed', 'forecast_changed', 'owner_changed', 'amount_changed',
    'stale_detected', 'opportunity_closed_won', 'opportunity_closed_lost',
    'reply_received', 'reply_classified', 'reply_assigned', 'reply_overdue', 'meeting_requested'
  ));
