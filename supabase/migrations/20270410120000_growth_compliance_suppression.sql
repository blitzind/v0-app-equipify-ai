-- Growth Engine Phase 2F — Bounce, unsubscribe, complaint, suppression layer.
-- Growth owns compliance intelligence. Providers transport only.

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
-- growth.email_bounces
-- -----------------------------------------------------------------------------

create table if not exists growth.email_bounces (
  id uuid primary key default gen_random_uuid(),
  delivery_attempt_id uuid not null references growth.delivery_attempts (id) on delete cascade,
  lead_id uuid references growth.leads (id) on delete set null,
  sender_account_id uuid not null references growth.sender_accounts (id) on delete cascade,
  provider_id uuid not null references growth.delivery_providers (id) on delete cascade,
  bounce_type text not null
    check (bounce_type in ('hard', 'soft', 'transient', 'blocked', 'spam')),
  provider_code text,
  provider_reason text,
  occurred_at timestamptz not null default now(),
  retry_allowed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_email_bounces_delivery_attempt
  on growth.email_bounces (delivery_attempt_id);

create index if not exists idx_growth_email_bounces_occurred_at
  on growth.email_bounces (occurred_at desc);

create index if not exists idx_growth_email_bounces_lead
  on growth.email_bounces (lead_id);

comment on table growth.email_bounces is
  'First-party bounce telemetry — hashed recipient identity, no raw provider payloads.';

-- -----------------------------------------------------------------------------
-- growth.email_complaints
-- -----------------------------------------------------------------------------

create table if not exists growth.email_complaints (
  id uuid primary key default gen_random_uuid(),
  delivery_attempt_id uuid not null references growth.delivery_attempts (id) on delete cascade,
  lead_id uuid references growth.leads (id) on delete set null,
  sender_account_id uuid not null references growth.sender_accounts (id) on delete cascade,
  provider_id uuid not null references growth.delivery_providers (id) on delete cascade,
  complaint_type text not null
    check (complaint_type in ('spam', 'abuse', 'manual', 'provider')),
  provider_reason text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_email_complaints_lead
  on growth.email_complaints (lead_id);

create index if not exists idx_growth_email_complaints_occurred_at
  on growth.email_complaints (occurred_at desc);

comment on table growth.email_complaints is
  'Complaint events — Growth Engine compliance layer, no provider lock-in.';

-- -----------------------------------------------------------------------------
-- growth.unsubscribe_registry
-- -----------------------------------------------------------------------------

create table if not exists growth.unsubscribe_registry (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null,
  scope text not null default 'global'
    check (scope in ('global', 'organization', 'sequence')),
  organization_id uuid,
  reason text,
  source text not null default 'manual',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_unsubscribe_registry_email_hash
  on growth.unsubscribe_registry (email_hash);

create index if not exists idx_growth_unsubscribe_registry_scope
  on growth.unsubscribe_registry (scope);

comment on table growth.unsubscribe_registry is
  'Hashed unsubscribe registry — no raw email storage.';

-- -----------------------------------------------------------------------------
-- growth.delivery_suppressions
-- -----------------------------------------------------------------------------

create table if not exists growth.delivery_suppressions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references growth.leads (id) on delete set null,
  email_hash text not null,
  reason text not null,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_delivery_suppressions_email_hash
  on growth.delivery_suppressions (email_hash);

create index if not exists idx_growth_delivery_suppressions_active
  on growth.delivery_suppressions (active);

comment on table growth.delivery_suppressions is
  'Active delivery suppressions enforced before transport send.';

-- -----------------------------------------------------------------------------
-- Extend lead timeline for compliance events
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

revoke all on table growth.email_bounces from public, anon, authenticated;
revoke all on table growth.email_complaints from public, anon, authenticated;
revoke all on table growth.unsubscribe_registry from public, anon, authenticated;
revoke all on table growth.delivery_suppressions from public, anon, authenticated;

grant select, insert, update, delete on table growth.email_bounces to service_role;
grant select, insert, update, delete on table growth.email_complaints to service_role;
grant select, insert, update, delete on table growth.unsubscribe_registry to service_role;
grant select, insert, update, delete on table growth.delivery_suppressions to service_role;

alter table growth.email_bounces enable row level security;
alter table growth.email_complaints enable row level security;
alter table growth.unsubscribe_registry enable row level security;
alter table growth.delivery_suppressions enable row level security;

alter table growth.email_bounces force row level security;
alter table growth.email_complaints force row level security;
alter table growth.unsubscribe_registry force row level security;
alter table growth.delivery_suppressions force row level security;

create policy growth_email_bounces_service_role
  on growth.email_bounces for all to service_role using (true) with check (true);

create policy growth_email_complaints_service_role
  on growth.email_complaints for all to service_role using (true) with check (true);

create policy growth_unsubscribe_registry_service_role
  on growth.unsubscribe_registry for all to service_role using (true) with check (true);

create policy growth_delivery_suppressions_service_role
  on growth.delivery_suppressions for all to service_role using (true) with check (true);
