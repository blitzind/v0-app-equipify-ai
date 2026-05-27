-- Growth Engine Phase 2E — Open tracking, click tracking, attribution layer.
-- First-party engagement telemetry only. Providers transport; Growth owns intelligence.

do $$
begin
  if to_regclass('growth.delivery_attempts') is null then
    raise exception 'Missing dependency: growth.delivery_attempts';
  end if;
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
  if to_regclass('growth.sender_accounts') is null then
    raise exception 'Missing dependency: growth.sender_accounts';
  end if;
  if to_regclass('growth.delivery_providers') is null then
    raise exception 'Missing dependency: growth.delivery_providers';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.email_opens
-- -----------------------------------------------------------------------------

create table if not exists growth.email_opens (
  id uuid primary key default gen_random_uuid(),
  delivery_attempt_id uuid not null references growth.delivery_attempts (id) on delete cascade,
  lead_id uuid references growth.leads (id) on delete set null,
  sender_account_id uuid not null references growth.sender_accounts (id) on delete cascade,
  provider_id uuid not null references growth.delivery_providers (id) on delete cascade,
  opened_at timestamptz not null default now(),
  user_agent text,
  ip_hash text,
  country text,
  city text,
  device_type text,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_email_opens_delivery_attempt
  on growth.email_opens (delivery_attempt_id);

create index if not exists idx_growth_email_opens_opened_at
  on growth.email_opens (opened_at desc);

create index if not exists idx_growth_email_opens_lead
  on growth.email_opens (lead_id);

comment on table growth.email_opens is
  'First-party email open telemetry — no third-party pixels or provider webhooks.';

-- -----------------------------------------------------------------------------
-- growth.email_clicks
-- -----------------------------------------------------------------------------

create table if not exists growth.email_clicks (
  id uuid primary key default gen_random_uuid(),
  delivery_attempt_id uuid not null references growth.delivery_attempts (id) on delete cascade,
  lead_id uuid references growth.leads (id) on delete set null,
  sender_account_id uuid not null references growth.sender_accounts (id) on delete cascade,
  provider_id uuid not null references growth.delivery_providers (id) on delete cascade,
  destination_url text not null,
  tracking_token text not null unique,
  clicked_at timestamptz not null default now(),
  user_agent text,
  ip_hash text,
  country text,
  device_type text,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_email_clicks_delivery_attempt
  on growth.email_clicks (delivery_attempt_id);

create index if not exists idx_growth_email_clicks_clicked_at
  on growth.email_clicks (clicked_at desc);

create index if not exists idx_growth_email_clicks_tracking_token
  on growth.email_clicks (tracking_token);

comment on table growth.email_clicks is
  'First-party email click telemetry with signed redirect tokens — no link vendors.';

-- -----------------------------------------------------------------------------
-- growth.engagement_scores
-- -----------------------------------------------------------------------------

create table if not exists growth.engagement_scores (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references growth.leads (id) on delete cascade,
  score integer not null default 0 check (score >= 0),
  tier text not null default 'cold'
    check (tier in ('cold', 'warm', 'engaged', 'hot')),
  opens integer not null default 0 check (opens >= 0),
  clicks integer not null default 0 check (clicks >= 0),
  meetings integer not null default 0 check (meetings >= 0),
  replies integer not null default 0 check (replies >= 0),
  last_activity_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_engagement_scores_lead
  on growth.engagement_scores (lead_id);

create index if not exists idx_growth_engagement_scores_score
  on growth.engagement_scores (score desc);

comment on table growth.engagement_scores is
  'Deterministic first-party engagement scores — Growth Engine attribution layer.';

-- -----------------------------------------------------------------------------
-- Extend lead timeline for attribution events
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

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.email_opens from public, anon, authenticated;
revoke all on table growth.email_clicks from public, anon, authenticated;
revoke all on table growth.engagement_scores from public, anon, authenticated;

grant select, insert, update, delete on table growth.email_opens to service_role;
grant select, insert, update, delete on table growth.email_clicks to service_role;
grant select, insert, update, delete on table growth.engagement_scores to service_role;

alter table growth.email_opens enable row level security;
alter table growth.email_clicks enable row level security;
alter table growth.engagement_scores enable row level security;

alter table growth.email_opens force row level security;
alter table growth.email_clicks force row level security;
alter table growth.engagement_scores force row level security;

create policy growth_email_opens_service_role
  on growth.email_opens for all to service_role using (true) with check (true);

create policy growth_email_clicks_service_role
  on growth.email_clicks for all to service_role using (true) with check (true);

create policy growth_engagement_scores_service_role
  on growth.engagement_scores for all to service_role using (true) with check (true);
