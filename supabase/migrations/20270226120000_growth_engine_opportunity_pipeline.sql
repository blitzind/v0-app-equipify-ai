-- Growth Engine Slice 6.19A — Opportunity pipeline + deal operating system.

create table if not exists growth.opportunity_pipeline_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique,
  stages jsonb not null default '[
    {"key":"new_opportunity","label":"New Opportunity","sortOrder":1,"isClosed":false,"isWon":false},
    {"key":"discovery","label":"Discovery","sortOrder":2,"isClosed":false,"isWon":false},
    {"key":"qualified","label":"Qualified","sortOrder":3,"isClosed":false,"isWon":false},
    {"key":"proposal","label":"Proposal","sortOrder":4,"isClosed":false,"isWon":false},
    {"key":"negotiation","label":"Negotiation","sortOrder":5,"isClosed":false,"isWon":false},
    {"key":"verbal_commit","label":"Verbal Commit","sortOrder":6,"isClosed":false,"isWon":false},
    {"key":"closed_won","label":"Closed Won","sortOrder":7,"isClosed":true,"isWon":true},
    {"key":"closed_lost","label":"Closed Lost","sortOrder":8,"isClosed":true,"isWon":false}
  ]'::jsonb,
  stage_probability_overrides jsonb not null default '{}'::jsonb,
  stale_stage_days int not null default 14 check (stale_stage_days > 0),
  stale_activity_days int not null default 21 check (stale_activity_days > 0),
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into growth.opportunity_pipeline_settings (singleton)
select true
where not exists (select 1 from growth.opportunity_pipeline_settings where singleton = true);

create table if not exists growth.opportunities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  owner_user_id uuid references auth.users (id) on delete set null,
  company_name text not null,
  title text not null,
  stage_key text not null,
  amount numeric not null default 0 check (amount >= 0),
  probability int not null default 20 check (probability >= 0 and probability <= 100),
  weighted_amount numeric not null default 0 check (weighted_amount >= 0),
  forecast_category text not null default 'pipeline'
    check (forecast_category in ('commit', 'best_case', 'pipeline', 'omitted')),
  expected_close_date date,
  source text not null default 'manual',
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'critical')),
  risk_score int not null default 0 check (risk_score >= 0 and risk_score <= 100),
  next_required_action text,
  loss_reason text,
  is_stale boolean not null default false,
  age_days int not null default 0 check (age_days >= 0),
  last_activity_at timestamptz not null default now(),
  stage_entered_at timestamptz not null default now(),
  closed_won_at timestamptz,
  closed_lost_at timestamptz,
  qa_marker text not null default 'growth-opportunity-pipeline-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id)
);

create index if not exists idx_growth_opportunities_owner_open
  on growth.opportunities (owner_user_id, stage_key, updated_at desc)
  where closed_won_at is null and closed_lost_at is null;

create index if not exists idx_growth_opportunities_stage
  on growth.opportunities (stage_key, forecast_category, priority);

create index if not exists idx_growth_opportunities_stale
  on growth.opportunities (is_stale, risk_score desc)
  where closed_won_at is null and closed_lost_at is null;

create index if not exists idx_growth_opportunities_close_date
  on growth.opportunities (expected_close_date)
  where expected_close_date is not null and closed_won_at is null and closed_lost_at is null;

create table if not exists growth.opportunity_stage_history (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references growth.opportunities (id) on delete cascade,
  from_stage_key text,
  to_stage_key text not null,
  amount numeric,
  probability int,
  changed_by text,
  changed_at timestamptz not null default now()
);

create index if not exists idx_opportunity_stage_history_opp
  on growth.opportunity_stage_history (opportunity_id, changed_at desc);

alter table growth.notifications
  drop constraint if exists notifications_opportunity_id_fkey;

alter table growth.notifications
  add constraint notifications_opportunity_id_fkey
  foreign key (opportunity_id) references growth.opportunities (id) on delete set null;

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
    'stale_detected', 'opportunity_closed_won', 'opportunity_closed_lost'
  ));

revoke all on table growth.opportunity_pipeline_settings from public, anon, authenticated;
revoke all on table growth.opportunities from public, anon, authenticated;
revoke all on table growth.opportunity_stage_history from public, anon, authenticated;

grant select, insert, update on table growth.opportunity_pipeline_settings to service_role;
grant select, insert, update, delete on table growth.opportunities to service_role;
grant select, insert on table growth.opportunity_stage_history to service_role;

alter table growth.opportunity_pipeline_settings enable row level security;
alter table growth.opportunities enable row level security;
alter table growth.opportunity_stage_history enable row level security;

alter table growth.opportunity_pipeline_settings force row level security;
alter table growth.opportunities force row level security;
alter table growth.opportunity_stage_history force row level security;
