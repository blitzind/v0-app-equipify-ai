-- Growth Engine Slice 6.17A — Lead assignment + ownership.

alter table growth.leads
  add column if not exists assigned_at timestamptz,
  add column if not exists assigned_by text,
  add column if not exists assignment_source text;

alter table growth.leads
  drop constraint if exists leads_assignment_source_check;

alter table growth.leads
  add constraint leads_assignment_source_check check (
    assignment_source is null
    or assignment_source in ('manual', 'rule', 'import', 'scheduler', 'manager_override')
  );

create index if not exists idx_growth_leads_assigned_at
  on growth.leads (assigned_at desc)
  where assigned_at is not null;

create index if not exists idx_growth_leads_assignment_source
  on growth.leads (assignment_source)
  where assignment_source is not null;

create index if not exists idx_growth_leads_unassigned_active
  on growth.leads (created_at desc)
  where assigned_to is null and status not in ('archived', 'converted', 'disqualified');

create table if not exists growth.rep_roster (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  status text not null default 'active' check (status in ('active', 'paused', 'inactive')),
  max_active_leads int not null default 50 check (max_active_leads > 0),
  max_daily_new_assignments int not null default 10 check (max_daily_new_assignments >= 0),
  industries text[] not null default '{}'::text[],
  territories text[] not null default '{}'::text[],
  lead_types text[] not null default '{}'::text[],
  round_robin_order int not null default 0,
  last_assigned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rep_roster_status_order
  on growth.rep_roster (status, round_robin_order);

create table if not exists growth.assignment_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique,
  round_robin_enabled boolean not null default true,
  industry_specialization_enabled boolean not null default false,
  territory_matching_enabled boolean not null default false,
  capacity_balancing_enabled boolean not null default true,
  priority_routing_enabled boolean not null default true,
  round_robin_cursor_user_id uuid references auth.users (id) on delete set null,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists growth.assignment_runs (
  id uuid primary key default gen_random_uuid(),
  run_mode text not null check (run_mode in ('live', 'dry_run')),
  scanned int not null default 0 check (scanned >= 0),
  assigned int not null default 0 check (assigned >= 0),
  skipped_manual int not null default 0 check (skipped_manual >= 0),
  skipped_capacity int not null default 0 check (skipped_capacity >= 0),
  skipped_no_rep int not null default 0 check (skipped_no_rep >= 0),
  failed int not null default 0 check (failed >= 0),
  qa_marker text not null default 'growth-lead-assignment-v1',
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_by text
);

create index if not exists idx_assignment_runs_started_at
  on growth.assignment_runs (started_at desc);

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
    'live_call_started', 'buying_signal_detected', 'objection_detected', 'discovery_gap_detected',
    'call_risk_detected', 'live_call_completed', 'live_guidance_generated', 'live_guidance_used'
  ));

revoke all on table growth.rep_roster from public, anon, authenticated;
grant select, insert, update, delete on table growth.rep_roster to service_role;
alter table growth.rep_roster enable row level security;
alter table growth.rep_roster force row level security;

revoke all on table growth.assignment_settings from public, anon, authenticated;
grant select, insert, update on table growth.assignment_settings to service_role;
alter table growth.assignment_settings enable row level security;
alter table growth.assignment_settings force row level security;

revoke all on table growth.assignment_runs from public, anon, authenticated;
grant select, insert, update on table growth.assignment_runs to service_role;
alter table growth.assignment_runs enable row level security;
alter table growth.assignment_runs force row level security;
