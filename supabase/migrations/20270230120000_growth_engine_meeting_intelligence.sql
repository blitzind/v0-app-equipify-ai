-- Growth Engine Slice 6.23A — Meeting + calendar intelligence.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

create table if not exists growth.meetings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  owner_user_id uuid references auth.users (id) on delete set null,
  opportunity_id uuid references growth.opportunities (id) on delete set null,
  outbound_reply_id uuid references growth.outbound_replies (id) on delete set null,
  realtime_call_session_id uuid references growth.realtime_call_sessions (id) on delete set null,
  title text not null,
  status text not null default 'proposed',
  start_at timestamptz,
  end_at timestamptz,
  source text not null default 'manual',
  provider text,
  calendar_event_id text,
  outcome text,
  next_action text,
  follow_up_due_at timestamptz,
  no_show_reason text,
  scheduled_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  no_show_at timestamptz,
  outcome_recorded_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  qa_marker text not null default 'meeting-intelligence-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table growth.meetings
  drop constraint if exists meetings_status_check;

alter table growth.meetings
  add constraint meetings_status_check
  check (status in ('proposed', 'scheduled', 'completed', 'no_show', 'canceled'));

alter table growth.meetings
  drop constraint if exists meetings_source_check;

alter table growth.meetings
  add constraint meetings_source_check
  check (source in ('manual', 'reply_intent', 'calendar_sync', 'live_coaching'));

alter table growth.meetings
  drop constraint if exists meetings_provider_check;

alter table growth.meetings
  add constraint meetings_provider_check
  check (
    provider is null
    or provider in ('google_meet', 'zoom', 'teams', 'phone', 'other')
  );

create index if not exists idx_growth_meetings_lead_start
  on growth.meetings (lead_id, start_at desc nulls last);

create index if not exists idx_growth_meetings_owner_status_start
  on growth.meetings (owner_user_id, status, start_at asc nulls last);

create index if not exists idx_growth_meetings_status_start
  on growth.meetings (status, start_at asc nulls last);

create index if not exists idx_growth_meetings_reply
  on growth.meetings (outbound_reply_id)
  where outbound_reply_id is not null;

create index if not exists idx_growth_meetings_follow_up_due
  on growth.meetings (follow_up_due_at asc)
  where follow_up_due_at is not null and status = 'completed';

create index if not exists idx_growth_meetings_outcome_missing
  on growth.meetings (completed_at desc)
  where status = 'completed' and outcome is null;

create unique index if not exists idx_growth_meetings_reply_proposed
  on growth.meetings (outbound_reply_id)
  where outbound_reply_id is not null and status = 'proposed';

revoke all on table growth.meetings from public, anon, authenticated;
grant select, insert, update on table growth.meetings to service_role;
alter table growth.meetings enable row level security;
alter table growth.meetings force row level security;

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
    'reply_received', 'reply_classified', 'reply_assigned', 'reply_overdue', 'meeting_requested',
    'meeting_created', 'meeting_scheduled', 'meeting_completed', 'meeting_no_show', 'meeting_canceled',
    'meeting_followup_due', 'meeting_outcome_recorded'
  ));
