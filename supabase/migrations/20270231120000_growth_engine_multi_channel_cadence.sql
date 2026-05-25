-- Growth Engine Slice 6.24A — Multi-channel cadence orchestration.

do $$
begin
  if to_regclass('growth.sequence_enrollment_steps') is null then
    raise exception 'Missing dependency: growth.sequence_enrollment_steps';
  end if;
end;
$$;

create table if not exists growth.cadence_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users (id) on delete set null,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  opportunity_id uuid references growth.opportunities (id) on delete set null,
  meeting_id uuid references growth.meetings (id) on delete set null,
  sequence_enrollment_step_id uuid references growth.sequence_enrollment_steps (id) on delete set null,
  channel text not null,
  title text not null,
  instructions text not null default '',
  template_draft text,
  suggested_sms_text text,
  due_at timestamptz,
  status text not null default 'open',
  priority text not null default 'medium',
  outcome text,
  skipped_reason text,
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,
  idempotency_key text,
  qa_marker text not null default 'multi-channel-cadence-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table growth.cadence_tasks
  drop constraint if exists cadence_tasks_channel_check;

alter table growth.cadence_tasks
  add constraint cadence_tasks_channel_check
  check (channel in (
    'email', 'manual_call', 'voicemail', 'linkedin_view_profile', 'linkedin_connect',
    'linkedin_message', 'sms_task', 'meeting_followup', 'manual_task', 'manual_follow_up'
  ));

alter table growth.cadence_tasks
  drop constraint if exists cadence_tasks_status_check;

alter table growth.cadence_tasks
  add constraint cadence_tasks_status_check
  check (status in ('open', 'completed', 'skipped'));

alter table growth.cadence_tasks
  drop constraint if exists cadence_tasks_priority_check;

alter table growth.cadence_tasks
  add constraint cadence_tasks_priority_check
  check (priority in ('critical', 'high', 'medium', 'low'));

alter table growth.cadence_tasks
  drop constraint if exists cadence_tasks_outcome_check;

alter table growth.cadence_tasks
  add constraint cadence_tasks_outcome_check
  check (
    outcome is null
    or outcome in (
      'completed', 'skipped', 'no_answer', 'left_voicemail', 'connected', 'interested',
      'not_interested', 'meeting_booked', 'followup_needed', 'wrong_contact'
    )
  );

create index if not exists idx_growth_cadence_tasks_owner_due
  on growth.cadence_tasks (owner_user_id, due_at asc nulls last, status);

create index if not exists idx_growth_cadence_tasks_status_due
  on growth.cadence_tasks (status, due_at asc nulls last);

create index if not exists idx_growth_cadence_tasks_channel_status
  on growth.cadence_tasks (channel, status, due_at asc nulls last);

create index if not exists idx_growth_cadence_tasks_lead
  on growth.cadence_tasks (lead_id, created_at desc);

create unique index if not exists idx_growth_cadence_tasks_enrollment_step_open
  on growth.cadence_tasks (sequence_enrollment_step_id)
  where sequence_enrollment_step_id is not null and status = 'open';

create unique index if not exists idx_growth_cadence_tasks_idempotency_open
  on growth.cadence_tasks (idempotency_key)
  where idempotency_key is not null and status = 'open';

alter table growth.sequence_enrollment_steps
  add column if not exists cadence_task_id uuid references growth.cadence_tasks (id) on delete set null,
  add column if not exists instructions text,
  add column if not exists step_outcome text,
  add column if not exists skip_reason text,
  add column if not exists opportunity_id uuid references growth.opportunities (id) on delete set null,
  add column if not exists meeting_id uuid references growth.meetings (id) on delete set null,
  add column if not exists due_at timestamptz;

alter table growth.sequence_pattern_steps
  drop constraint if exists sequence_pattern_steps_channel_check;

alter table growth.sequence_pattern_steps
  add constraint sequence_pattern_steps_channel_check
  check (channel in (
    'email', 'manual_call', 'voicemail', 'linkedin_view_profile', 'linkedin_connect',
    'linkedin_message', 'sms_task', 'meeting_followup', 'manual_task', 'manual_follow_up'
  ));

alter table growth.sequence_enrollment_steps
  drop constraint if exists sequence_enrollment_steps_channel_check;

alter table growth.sequence_enrollment_steps
  add constraint sequence_enrollment_steps_channel_check
  check (channel in (
    'email', 'manual_call', 'voicemail', 'linkedin_view_profile', 'linkedin_connect',
    'linkedin_message', 'sms_task', 'meeting_followup', 'manual_task', 'manual_follow_up'
  ));

alter table growth.outreach_queue
  drop constraint if exists outreach_queue_channel_check;

alter table growth.outreach_queue
  add constraint outreach_queue_channel_check
  check (channel in (
    'email', 'manual_call', 'voicemail', 'linkedin_view_profile', 'linkedin_connect',
    'linkedin_message', 'sms_task', 'meeting_followup', 'manual_task', 'manual_follow_up'
  ));

revoke all on table growth.cadence_tasks from public, anon, authenticated;
grant select, insert, update on table growth.cadence_tasks to service_role;
alter table growth.cadence_tasks enable row level security;
alter table growth.cadence_tasks force row level security;

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
    'meeting_followup_due', 'meeting_outcome_recorded',
    'cadence_task_created', 'cadence_task_due', 'cadence_task_completed', 'cadence_task_skipped',
    'cadence_step_completed', 'cadence_step_skipped'
  ));
