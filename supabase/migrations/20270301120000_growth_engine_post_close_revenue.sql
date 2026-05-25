-- Growth Engine Slice 6.25A — Post-close revenue / customer lifecycle engine.

do $$
begin
  if to_regclass('growth.opportunities') is null then
    raise exception 'Missing dependency: growth.opportunities';
  end if;
end;
$$;

create table if not exists growth.customer_lifecycle_settings (
  id uuid primary key default gen_random_uuid(),
  onboarding_sla_days int not null default 14,
  renewal_window_days int not null default 90,
  renewal_risk_days int not null default 30,
  inactivity_days int not null default 45,
  referral_min_lifecycle_days int not null default 90,
  referral_min_health_score int not null default 70,
  review_min_health_score int not null default 60,
  qa_marker text not null default 'post-close-revenue-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into growth.customer_lifecycle_settings (id)
select gen_random_uuid()
where not exists (select 1 from growth.customer_lifecycle_settings limit 1);

create table if not exists growth.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  opportunity_id uuid not null references growth.opportunities (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  owner_user_id uuid references auth.users (id) on delete set null,
  company_name text not null,
  lifecycle_stage text not null default 'onboarding_pending',
  onboarding_status text not null default 'pending',
  closed_won_at timestamptz not null,
  activation_at timestamptz,
  first_value_at timestamptz,
  health_score int not null default 50 check (health_score >= 0 and health_score <= 100),
  expansion_score int not null default 0 check (expansion_score >= 0 and expansion_score <= 100),
  renewal_date date,
  renewal_window_open boolean not null default false,
  last_engagement_at timestamptz,
  review_status text not null default 'none',
  referral_status text not null default 'none',
  review_requested_at timestamptz,
  review_received_at timestamptz,
  referral_requested_at timestamptz,
  referral_received_at timestamptz,
  expansion_opportunity_count int not null default 0,
  churn_indicators jsonb not null default '[]'::jsonb,
  qa_marker text not null default 'post-close-revenue-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table growth.customer_profiles
  drop constraint if exists customer_profiles_lifecycle_stage_check;

alter table growth.customer_profiles
  add constraint customer_profiles_lifecycle_stage_check
  check (lifecycle_stage in (
    'onboarding_pending', 'onboarding_active', 'activated', 'healthy',
    'expansion_candidate', 'renewal_due', 'churn_risk', 'inactive'
  ));

alter table growth.customer_profiles
  drop constraint if exists customer_profiles_onboarding_status_check;

alter table growth.customer_profiles
  add constraint customer_profiles_onboarding_status_check
  check (onboarding_status in ('pending', 'active', 'completed'));

alter table growth.customer_profiles
  drop constraint if exists customer_profiles_review_status_check;

alter table growth.customer_profiles
  add constraint customer_profiles_review_status_check
  check (review_status in ('none', 'review_pending', 'review_requested', 'review_received'));

alter table growth.customer_profiles
  drop constraint if exists customer_profiles_referral_status_check;

alter table growth.customer_profiles
  add constraint customer_profiles_referral_status_check
  check (referral_status in (
    'none', 'referral_eligible', 'referral_requested', 'referral_received'
  ));

create unique index if not exists idx_growth_customer_profiles_lead
  on growth.customer_profiles (lead_id);

create unique index if not exists idx_growth_customer_profiles_opportunity
  on growth.customer_profiles (opportunity_id);

create index if not exists idx_growth_customer_profiles_owner_stage
  on growth.customer_profiles (owner_user_id, lifecycle_stage, updated_at desc);

create index if not exists idx_growth_customer_profiles_renewal
  on growth.customer_profiles (renewal_date asc nulls last, lifecycle_stage)
  where renewal_date is not null;

create index if not exists idx_growth_customer_profiles_health
  on growth.customer_profiles (health_score desc, lifecycle_stage);

create table if not exists growth.customer_onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid not null references growth.customer_profiles (id) on delete cascade,
  owner_user_id uuid references auth.users (id) on delete set null,
  task_key text not null,
  title text not null,
  instructions text not null default '',
  due_at timestamptz,
  status text not null default 'open',
  outcome text,
  skipped_reason text,
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,
  qa_marker text not null default 'post-close-revenue-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table growth.customer_onboarding_tasks
  drop constraint if exists customer_onboarding_tasks_task_key_check;

alter table growth.customer_onboarding_tasks
  add constraint customer_onboarding_tasks_task_key_check
  check (task_key in (
    'kickoff_meeting', 'account_setup', 'training_complete', 'implementation_complete',
    'first_success_milestone', 'onboarding_review'
  ));

alter table growth.customer_onboarding_tasks
  drop constraint if exists customer_onboarding_tasks_status_check;

alter table growth.customer_onboarding_tasks
  add constraint customer_onboarding_tasks_status_check
  check (status in ('open', 'completed', 'skipped'));

create index if not exists idx_growth_customer_onboarding_tasks_profile
  on growth.customer_onboarding_tasks (customer_profile_id, status, due_at asc nulls last);

create index if not exists idx_growth_customer_onboarding_tasks_owner_due
  on growth.customer_onboarding_tasks (owner_user_id, due_at asc nulls last, status);

create unique index if not exists idx_growth_customer_onboarding_tasks_profile_key_open
  on growth.customer_onboarding_tasks (customer_profile_id, task_key)
  where status = 'open';

revoke all on table growth.customer_lifecycle_settings from public, anon, authenticated;
grant select, insert, update on table growth.customer_lifecycle_settings to service_role;
alter table growth.customer_lifecycle_settings enable row level security;
alter table growth.customer_lifecycle_settings force row level security;

revoke all on table growth.customer_profiles from public, anon, authenticated;
grant select, insert, update on table growth.customer_profiles to service_role;
alter table growth.customer_profiles enable row level security;
alter table growth.customer_profiles force row level security;

revoke all on table growth.customer_onboarding_tasks from public, anon, authenticated;
grant select, insert, update on table growth.customer_onboarding_tasks to service_role;
alter table growth.customer_onboarding_tasks enable row level security;
alter table growth.customer_onboarding_tasks force row level security;

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
    'cadence_step_completed', 'cadence_step_skipped',
    'customer_created', 'onboarding_started', 'onboarding_completed', 'activation_recorded',
    'review_requested', 'review_received', 'referral_requested', 'referral_received',
    'renewal_window_opened', 'renewal_due', 'expansion_candidate_detected', 'churn_risk_detected'
  ));
