-- Growth Engine slice 6.10A: Live Guidance Overlay + Real-Time Coaching Engine.

do $$
begin
  if to_regclass('growth.realtime_call_sessions') is null then
    raise exception 'Missing dependency: growth.realtime_call_sessions';
  end if;
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

create table if not exists growth.live_guidance_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  realtime_call_session_id uuid not null references growth.realtime_call_sessions (id) on delete cascade,
  event_type text not null check (event_type in (
    'objection_guidance',
    'discovery_gap_guidance',
    'competitor_response',
    'talking_too_much',
    'ask_followup_question',
    'buying_signal_detected',
    'urgency_detected',
    'pricing_pressure',
    'executive_risk',
    'close_attempt_recommended',
    'meeting_lock_prompt',
    'silence_recovery',
    'momentum_drop',
    'relationship_recovery'
  )),
  severity text not null check (severity in ('low', 'medium', 'high')),
  title text not null,
  operator_prompt text not null,
  recommendation text not null,
  supporting_reason text not null,
  confidence_score int not null default 0 check (confidence_score >= 0 and confidence_score <= 100),
  surfaced_at timestamptz not null default now(),
  dismissed_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_live_guidance_events_session_surfaced
  on growth.live_guidance_events (realtime_call_session_id, surfaced_at desc);

create index if not exists idx_live_guidance_events_severity
  on growth.live_guidance_events (severity);

create index if not exists idx_live_guidance_events_event_type
  on growth.live_guidance_events (event_type);

revoke all on table growth.live_guidance_events from public, anon, authenticated;
grant select, insert, update, delete on table growth.live_guidance_events to service_role;
alter table growth.live_guidance_events enable row level security;
alter table growth.live_guidance_events force row level security;

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
    'conversation_health_changed', 'buying_intent_detected', 'competitor_detected',
    'urgency_detected', 'conversation_risk_detected',
    'sequence_pattern_detected', 'sequence_recommendation_changed',
    'sequence_enrollment_created', 'sequence_step_created', 'sequence_step_queued',
    'sequence_step_executed', 'sequence_enrollment_completed', 'sequence_enrollment_cancelled',
    'outreach_queued', 'outreach_approved', 'outreach_executed', 'outreach_failed', 'outreach_cancelled',
    'live_call_started', 'buying_signal_detected', 'objection_detected',
    'discovery_gap_detected', 'call_risk_detected', 'live_call_completed',
    'live_guidance_generated', 'live_guidance_used'
  ));
