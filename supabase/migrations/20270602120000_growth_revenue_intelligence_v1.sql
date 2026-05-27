-- Growth Engine Phase 6 — Revenue intelligence + opportunity orchestration.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Extend opportunity signal types
-- -----------------------------------------------------------------------------

alter table growth.opportunity_signals
  drop constraint if exists opportunity_signals_signal_type_check;

alter table growth.opportunity_signals
  add constraint opportunity_signals_signal_type_check
  check (signal_type in (
    'meeting_interest', 'pricing_interest', 'timeline_interest',
    'decision_maker_detected', 'committee_detected', 'budget_signal',
    'technical_validation', 'proposal_request', 'competitive_signal', 'urgency_signal',
    'demo_request', 'implementation_discussion', 'technical_evaluation',
    'replacement_intent', 'roi_discussion', 'engagement_acceleration',
    'meeting_attendance', 'follow_up_responsiveness', 'multi_person_engagement'
  ));

-- -----------------------------------------------------------------------------
-- Buying momentum snapshots (deterministic, explainable)
-- -----------------------------------------------------------------------------

create table if not exists growth.buying_momentum_snapshots (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  snapshot_date date not null,
  momentum_score numeric not null default 0 check (momentum_score >= 0 and momentum_score <= 100),
  momentum_trend text not null default 'steady'
    check (momentum_trend in ('accelerating', 'steady', 'cooling', 'stalled')),
  reply_velocity_score numeric not null default 0,
  engagement_depth_score numeric not null default 0,
  stakeholder_count int not null default 0,
  objection_resolution_score numeric not null default 0,
  outbound_interaction_score numeric not null default 0,
  evidence jsonb not null default '[]'::jsonb,
  explainability jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-revenue-intelligence-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_growth_buying_momentum_lead_date
  on growth.buying_momentum_snapshots (lead_id, snapshot_date);

create index if not exists idx_growth_buying_momentum_score
  on growth.buying_momentum_snapshots (momentum_score desc, snapshot_date desc);

-- -----------------------------------------------------------------------------
-- Buying committee maps
-- -----------------------------------------------------------------------------

create table if not exists growth.buying_committee_maps (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  snapshot_date date not null,
  stakeholder_count int not null default 0,
  completeness_score numeric not null default 0 check (completeness_score >= 0 and completeness_score <= 100),
  committee_members jsonb not null default '[]'::jsonb,
  missing_stakeholder_suggestions jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  qa_marker text not null default 'growth-revenue-intelligence-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_growth_buying_committee_map_lead_date
  on growth.buying_committee_maps (lead_id, snapshot_date);

-- -----------------------------------------------------------------------------
-- Sales execution insight snapshots
-- -----------------------------------------------------------------------------

create table if not exists growth.sales_execution_insight_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  scope_type text not null check (scope_type in ('global', 'operator', 'campaign', 'sender', 'domain', 'sequence')),
  scope_id uuid,
  reply_quality_score numeric not null default 0,
  objection_resolution_rate numeric not null default 0,
  meeting_conversion_rate numeric not null default 0,
  opportunity_conversion_rate numeric not null default 0,
  operator_response_quality numeric not null default 0,
  metrics jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-revenue-intelligence-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_sales_execution_insight_date
  on growth.sales_execution_insight_snapshots (snapshot_date desc, scope_type);

-- -----------------------------------------------------------------------------
-- Campaign revenue attribution snapshots
-- -----------------------------------------------------------------------------

create table if not exists growth.campaign_revenue_attribution_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  campaign_id uuid references growth.outbound_campaigns (id) on delete set null,
  sequence_enrollment_id uuid,
  sender_account_id uuid,
  domain text,
  opportunities_generated int not null default 0,
  demo_requests int not null default 0,
  pricing_questions int not null default 0,
  positive_replies int not null default 0,
  objection_replies int not null default 0,
  attribution_weight numeric not null default 1,
  metrics jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-revenue-intelligence-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_campaign_revenue_attribution_date
  on growth.campaign_revenue_attribution_snapshots (snapshot_date desc);

-- -----------------------------------------------------------------------------
-- Opportunity signal timeline events
-- -----------------------------------------------------------------------------

create table if not exists growth.opportunity_signal_timeline_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  signal_id uuid references growth.opportunity_signals (id) on delete set null,
  outbound_reply_id uuid references growth.outbound_replies (id) on delete set null,
  event_kind text not null,
  signal_type text,
  confidence text,
  evidence_excerpt text not null default '',
  source text not null default 'reply_intelligence_v2',
  occurred_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_opportunity_signal_timeline_lead
  on growth.opportunity_signal_timeline_events (lead_id, occurred_at desc);

-- -----------------------------------------------------------------------------
-- Extend revenue attribution event types
-- -----------------------------------------------------------------------------

alter table growth.revenue_attribution_events
  drop constraint if exists revenue_attribution_events_event_type_check;

alter table growth.revenue_attribution_events
  add constraint revenue_attribution_events_event_type_check
  check (event_type in (
    'meeting_booked',
    'opportunity_created',
    'opportunity_won',
    'pipeline_value',
    'demo_request_detected',
    'pricing_question_detected',
    'positive_reply_detected',
    'momentum_accelerated'
  ));

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
    'buying_momentum_updated', 'opportunity_signal_timeline_recorded', 'revenue_intelligence_copilot_assisted',
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

revoke all on table growth.buying_momentum_snapshots from public, anon, authenticated;
revoke all on table growth.buying_committee_maps from public, anon, authenticated;
revoke all on table growth.sales_execution_insight_snapshots from public, anon, authenticated;
revoke all on table growth.campaign_revenue_attribution_snapshots from public, anon, authenticated;
revoke all on table growth.opportunity_signal_timeline_events from public, anon, authenticated;

grant select, insert, update, delete on table growth.buying_momentum_snapshots to service_role;
grant select, insert, update, delete on table growth.buying_committee_maps to service_role;
grant select, insert, update, delete on table growth.sales_execution_insight_snapshots to service_role;
grant select, insert, update, delete on table growth.campaign_revenue_attribution_snapshots to service_role;
grant select, insert, update, delete on table growth.opportunity_signal_timeline_events to service_role;

alter table growth.buying_momentum_snapshots enable row level security;
alter table growth.buying_committee_maps enable row level security;
alter table growth.sales_execution_insight_snapshots enable row level security;
alter table growth.campaign_revenue_attribution_snapshots enable row level security;
alter table growth.opportunity_signal_timeline_events enable row level security;

alter table growth.buying_momentum_snapshots force row level security;
alter table growth.buying_committee_maps force row level security;
alter table growth.sales_execution_insight_snapshots force row level security;
alter table growth.campaign_revenue_attribution_snapshots force row level security;
alter table growth.opportunity_signal_timeline_events force row level security;
