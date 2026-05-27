-- Growth Engine Phase 2G — Provider webhook event ingestion.
-- Growth owns delivery state, compliance, suppression, attribution, timeline, sender reputation.
-- Providers transport only — no raw provider payload exposure.

do $$
begin
  if to_regclass('growth.delivery_attempts') is null then
    raise exception 'Missing dependency: growth.delivery_attempts';
  end if;
  if to_regclass('growth.delivery_providers') is null then
    raise exception 'Missing dependency: growth.delivery_providers';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.provider_webhook_endpoints
-- -----------------------------------------------------------------------------

create table if not exists growth.provider_webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  provider_family text not null,
  endpoint_slug text not null unique,
  status text not null default 'active'
    check (status in ('active', 'disabled', 'simulation')),
  signing_secret_hash text,
  last_received_at timestamptz,
  last_success_at timestamptz,
  failure_count integer not null default 0 check (failure_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_provider_webhook_endpoints_family
  on growth.provider_webhook_endpoints (provider_family);

create index if not exists idx_growth_provider_webhook_endpoints_status
  on growth.provider_webhook_endpoints (status);

create index if not exists idx_growth_provider_webhook_endpoints_slug
  on growth.provider_webhook_endpoints (endpoint_slug);

comment on table growth.provider_webhook_endpoints is
  'Provider webhook endpoint registry — signing secret stored as hash only, never raw.';

-- -----------------------------------------------------------------------------
-- growth.provider_delivery_events
-- -----------------------------------------------------------------------------

create table if not exists growth.provider_delivery_events (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references growth.delivery_providers (id) on delete set null,
  provider_family text not null,
  delivery_attempt_id uuid references growth.delivery_attempts (id) on delete set null,
  provider_message_id text,
  event_type text not null,
  normalized_event_type text not null
    check (normalized_event_type in (
      'delivered', 'deferred', 'bounced', 'complained', 'unsubscribed',
      'opened', 'clicked', 'failed', 'dropped', 'unknown'
    )),
  event_status text not null default 'received',
  lead_id uuid references growth.leads (id) on delete set null,
  sender_account_id uuid references growth.sender_accounts (id) on delete set null,
  occurred_at timestamptz not null default now(),
  payload_hash text not null,
  sanitized_payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processed', 'failed', 'duplicate', 'signature_failed')),
  processing_error text,
  created_at timestamptz not null default now(),
  constraint growth_provider_delivery_events_payload_hash_unique unique (payload_hash)
);

create index if not exists idx_growth_provider_delivery_events_family
  on growth.provider_delivery_events (provider_family);

create index if not exists idx_growth_provider_delivery_events_message_id
  on growth.provider_delivery_events (provider_message_id);

create index if not exists idx_growth_provider_delivery_events_attempt
  on growth.provider_delivery_events (delivery_attempt_id);

create index if not exists idx_growth_provider_delivery_events_normalized
  on growth.provider_delivery_events (normalized_event_type);

create index if not exists idx_growth_provider_delivery_events_occurred_at
  on growth.provider_delivery_events (occurred_at desc);

comment on table growth.provider_delivery_events is
  'Sanitized provider delivery webhook events — hashed idempotency, no raw provider secrets.';

-- -----------------------------------------------------------------------------
-- Delivery attempt lookup for provider message correlation
-- -----------------------------------------------------------------------------

create index if not exists idx_growth_delivery_attempts_provider_message
  on growth.delivery_attempts (provider_message_id)
  where provider_message_id is not null;

-- -----------------------------------------------------------------------------
-- Extend lead timeline for provider webhook events
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

revoke all on table growth.provider_webhook_endpoints from public, anon, authenticated;
revoke all on table growth.provider_delivery_events from public, anon, authenticated;

grant select, insert, update, delete on table growth.provider_webhook_endpoints to service_role;
grant select, insert, update, delete on table growth.provider_delivery_events to service_role;

alter table growth.provider_webhook_endpoints enable row level security;
alter table growth.provider_delivery_events enable row level security;

alter table growth.provider_webhook_endpoints force row level security;
alter table growth.provider_delivery_events force row level security;

create policy growth_provider_webhook_endpoints_service_role
  on growth.provider_webhook_endpoints for all to service_role using (true) with check (true);

create policy growth_provider_delivery_events_service_role
  on growth.provider_delivery_events for all to service_role using (true) with check (true);
