-- Growth Engine Phase 2H — Sequence safe execution worker.
-- Growth owns scheduling, approval gates, compliance, routing, rate limits, attribution, audit.
-- Providers transport only. No autonomous sends.

do $$
begin
  if to_regclass('growth.sequence_enrollments') is null then
    raise exception 'Missing dependency: growth.sequence_enrollments';
  end if;
  if to_regclass('growth.sequence_enrollment_steps') is null then
    raise exception 'Missing dependency: growth.sequence_enrollment_steps';
  end if;
  if to_regclass('growth.delivery_attempts') is null then
    raise exception 'Missing dependency: growth.delivery_attempts';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.sequence_execution_jobs
-- -----------------------------------------------------------------------------

create table if not exists growth.sequence_execution_jobs (
  id uuid primary key default gen_random_uuid(),
  sequence_enrollment_id uuid not null references growth.sequence_enrollments (id) on delete cascade,
  sequence_step_id uuid references growth.sequence_enrollment_steps (id) on delete set null,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  sender_account_id uuid references growth.sender_accounts (id) on delete set null,
  provider_id uuid references growth.delivery_providers (id) on delete set null,
  status text not null default 'draft'
    check (status in (
      'draft', 'pending_approval', 'approved', 'scheduled', 'running',
      'sent', 'blocked', 'failed', 'skipped'
    )),
  scheduled_for timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  delivery_attempt_id uuid references growth.delivery_attempts (id) on delete set null,
  requires_human_approval boolean not null default true,
  human_approved_at timestamptz,
  human_approved_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_sequence_execution_jobs_status
  on growth.sequence_execution_jobs (status);

create index if not exists idx_growth_sequence_execution_jobs_scheduled_for
  on growth.sequence_execution_jobs (scheduled_for);

create index if not exists idx_growth_sequence_execution_jobs_lead
  on growth.sequence_execution_jobs (lead_id);

create index if not exists idx_growth_sequence_execution_jobs_enrollment
  on growth.sequence_execution_jobs (sequence_enrollment_id);

create unique index if not exists idx_growth_sequence_execution_jobs_active_step
  on growth.sequence_execution_jobs (sequence_enrollment_id, sequence_step_id)
  where sequence_step_id is not null
    and status in ('draft', 'pending_approval', 'approved', 'scheduled', 'running');

comment on table growth.sequence_execution_jobs is
  'Human-gated sequence execution jobs — one active job per enrollment step, no autonomous send.';

-- -----------------------------------------------------------------------------
-- growth.sequence_execution_job_events
-- -----------------------------------------------------------------------------

create table if not exists growth.sequence_execution_job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references growth.sequence_execution_jobs (id) on delete cascade,
  event_type text not null,
  severity text not null default 'info'
    check (severity in ('info', 'low', 'medium', 'high', 'critical')),
  title text not null default '',
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_sequence_execution_job_events_job
  on growth.sequence_execution_job_events (job_id);

create index if not exists idx_growth_sequence_execution_job_events_created
  on growth.sequence_execution_job_events (created_at desc);

comment on table growth.sequence_execution_job_events is
  'Audit trail for sequence execution jobs — sanitized metadata only.';

-- -----------------------------------------------------------------------------
-- Extend lead timeline for safe execution events
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
    'renewal_window_opened', 'renewal_due', 'expansion_candidate_detected', 'churn_risk_detected'
  ));

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.sequence_execution_jobs from public, anon, authenticated;
revoke all on table growth.sequence_execution_job_events from public, anon, authenticated;

grant select, insert, update, delete on table growth.sequence_execution_jobs to service_role;
grant select, insert, update, delete on table growth.sequence_execution_job_events to service_role;

alter table growth.sequence_execution_jobs enable row level security;
alter table growth.sequence_execution_job_events enable row level security;

alter table growth.sequence_execution_jobs force row level security;
alter table growth.sequence_execution_job_events force row level security;

create policy growth_sequence_execution_jobs_service_role
  on growth.sequence_execution_jobs for all to service_role using (true) with check (true);

create policy growth_sequence_execution_job_events_service_role
  on growth.sequence_execution_job_events for all to service_role using (true) with check (true);
