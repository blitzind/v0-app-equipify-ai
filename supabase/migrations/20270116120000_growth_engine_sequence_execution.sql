-- Growth Engine slice 6.7A: guided sequence execution (enrollments + steps).

do $$
begin
  if to_regclass('growth.sequence_patterns') is null then
    raise exception 'Missing dependency: growth.sequence_patterns';
  end if;
end;
$$;

create table if not exists growth.sequence_enrollments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  sequence_pattern_id uuid not null references growth.sequence_patterns (id) on delete restrict,
  sequence_version int not null default 1 check (sequence_version >= 1),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'completed', 'cancelled')),
  current_step_order int not null default 0 check (current_step_order >= 0),
  enrollment_health_score int not null default 50
    check (enrollment_health_score >= 0 and enrollment_health_score <= 100),
  enrollment_stalled boolean not null default false,
  owner_user_id uuid references auth.users (id) on delete set null,
  pause_reason text,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_sequence_enrollments_one_active_per_lead
  on growth.sequence_enrollments (lead_id)
  where status in ('active', 'paused');

create index if not exists idx_sequence_enrollments_status_started
  on growth.sequence_enrollments (status, started_at desc nulls last);

create index if not exists idx_sequence_enrollments_stalled
  on growth.sequence_enrollments (enrollment_stalled)
  where enrollment_stalled = true;

create table if not exists growth.sequence_enrollment_steps (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references growth.sequence_enrollments (id) on delete cascade,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  sequence_pattern_step_id uuid not null references growth.sequence_pattern_steps (id) on delete restrict,
  step_order int not null check (step_order >= 1),
  channel text not null check (channel in ('email', 'manual_call', 'manual_follow_up')),
  generation_type text,
  scheduled_for timestamptz,
  status text not null default 'pending'
    check (status in (
      'pending', 'draft_created', 'queued', 'approved', 'executed', 'skipped', 'failed', 'cancelled'
    )),
  step_execution_confidence int not null default 50
    check (step_execution_confidence >= 0 and step_execution_confidence <= 100),
  outreach_queue_id uuid references growth.outreach_queue (id) on delete set null,
  generation_id uuid references growth.ai_copilot_generations (id) on delete set null,
  completed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrollment_id, step_order)
);

create index if not exists idx_sequence_enrollment_steps_enrollment
  on growth.sequence_enrollment_steps (enrollment_id, step_order);

create index if not exists idx_sequence_enrollment_steps_status_scheduled
  on growth.sequence_enrollment_steps (status, scheduled_for nulls last);

alter table growth.leads
  add column if not exists active_sequence_enrollment_id uuid references growth.sequence_enrollments (id) on delete set null;

alter table growth.outreach_queue
  add column if not exists sequence_enrollment_step_id uuid references growth.sequence_enrollment_steps (id) on delete set null;

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
    'sequence_step_executed', 'sequence_enrollment_completed', 'sequence_enrollment_cancelled'
  ));

revoke all on table growth.sequence_enrollments from public, anon, authenticated;
revoke all on table growth.sequence_enrollment_steps from public, anon, authenticated;
grant select, insert, update, delete on table growth.sequence_enrollments to service_role;
grant select, insert, update, delete on table growth.sequence_enrollment_steps to service_role;
alter table growth.sequence_enrollments enable row level security;
alter table growth.sequence_enrollment_steps enable row level security;
alter table growth.sequence_enrollments force row level security;
alter table growth.sequence_enrollment_steps force row level security;
