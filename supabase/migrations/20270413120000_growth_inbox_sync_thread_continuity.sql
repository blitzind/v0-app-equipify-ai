-- Growth Engine Phase 2I — Inbox sync + thread continuity.
-- Growth owns unified inbox, classification, thread ownership, compliance, attribution, timeline.
-- Providers supply mailbox messages only. No autonomous replies or sends.

do $$
begin
  if to_regclass('growth.mailbox_connections') is null then
    raise exception 'Missing dependency: growth.mailbox_connections';
  end if;
  if to_regclass('growth.inbox_threads') is null then
    raise exception 'Missing dependency: growth.inbox_threads';
  end if;
  if to_regclass('growth.inbox_messages') is null then
    raise exception 'Missing dependency: growth.inbox_messages';
  end if;
  if to_regclass('growth.delivery_attempts') is null then
    raise exception 'Missing dependency: growth.delivery_attempts';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.inbox_sync_runs
-- -----------------------------------------------------------------------------

create table if not exists growth.inbox_sync_runs (
  id uuid primary key default gen_random_uuid(),
  mailbox_connection_id uuid not null references growth.mailbox_connections (id) on delete cascade,
  provider_family text not null,
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  messages_seen integer not null default 0 check (messages_seen >= 0),
  messages_imported integer not null default 0 check (messages_imported >= 0),
  threads_matched integer not null default 0 check (threads_matched >= 0),
  threads_created integer not null default 0 check (threads_created >= 0),
  duplicates_skipped integer not null default 0 check (duplicates_skipped >= 0),
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_inbox_sync_runs_mailbox
  on growth.inbox_sync_runs (mailbox_connection_id);

create index if not exists idx_growth_inbox_sync_runs_provider
  on growth.inbox_sync_runs (provider_family);

create index if not exists idx_growth_inbox_sync_runs_started
  on growth.inbox_sync_runs (started_at desc);

create index if not exists idx_growth_inbox_sync_runs_status
  on growth.inbox_sync_runs (status);

comment on table growth.inbox_sync_runs is
  'Mailbox sync run audit — import only, no provider mailbox mutation in Phase 2I.';

-- -----------------------------------------------------------------------------
-- growth.inbox_provider_message_map
-- -----------------------------------------------------------------------------

create table if not exists growth.inbox_provider_message_map (
  id uuid primary key default gen_random_uuid(),
  mailbox_connection_id uuid not null references growth.mailbox_connections (id) on delete cascade,
  provider_family text not null,
  provider_message_id text not null,
  provider_thread_id text,
  inbox_thread_id uuid not null references growth.inbox_threads (id) on delete cascade,
  inbox_message_id uuid not null references growth.inbox_messages (id) on delete cascade,
  delivery_attempt_id uuid references growth.delivery_attempts (id) on delete set null,
  message_hash text not null default '',
  created_at timestamptz not null default now(),
  unique (provider_family, provider_message_id)
);

create index if not exists idx_growth_inbox_provider_message_map_mailbox
  on growth.inbox_provider_message_map (mailbox_connection_id);

create index if not exists idx_growth_inbox_provider_message_map_provider_thread
  on growth.inbox_provider_message_map (provider_thread_id);

create index if not exists idx_growth_inbox_provider_message_map_inbox_thread
  on growth.inbox_provider_message_map (inbox_thread_id);

create index if not exists idx_growth_inbox_provider_message_map_hash
  on growth.inbox_provider_message_map (message_hash);

comment on table growth.inbox_provider_message_map is
  'Provider message idempotency map — sanitized metadata only, no raw payloads.';

-- -----------------------------------------------------------------------------
-- growth.inbox_thread_links
-- -----------------------------------------------------------------------------

create table if not exists growth.inbox_thread_links (
  id uuid primary key default gen_random_uuid(),
  inbox_thread_id uuid not null references growth.inbox_threads (id) on delete cascade,
  lead_id uuid references growth.leads (id) on delete set null,
  sequence_enrollment_id uuid references growth.sequence_enrollments (id) on delete set null,
  delivery_attempt_id uuid references growth.delivery_attempts (id) on delete set null,
  link_reason text not null default '',
  confidence integer not null default 0 check (confidence >= 0 and confidence <= 100),
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_inbox_thread_links_thread
  on growth.inbox_thread_links (inbox_thread_id);

create index if not exists idx_growth_inbox_thread_links_lead
  on growth.inbox_thread_links (lead_id);

create index if not exists idx_growth_inbox_thread_links_enrollment
  on growth.inbox_thread_links (sequence_enrollment_id);

create index if not exists idx_growth_inbox_thread_links_delivery
  on growth.inbox_thread_links (delivery_attempt_id);

comment on table growth.inbox_thread_links is
  'Thread continuity links — lead, sequence enrollment, delivery attempt attribution.';

-- -----------------------------------------------------------------------------
-- Extend platform timeline for inbox sync events
-- -----------------------------------------------------------------------------

alter table growth.platform_timeline_events
  drop constraint if exists platform_timeline_events_event_type_check;

alter table growth.platform_timeline_events
  add constraint platform_timeline_events_event_type_check
  check (event_type in (
    'provider_connected',
    'provider_validation_failed',
    'provider_disabled',
    'provider_reconnected',
    'sender_connected',
    'sender_disabled',
    'sender_score_changed',
    'domain_health_declined',
    'domain_validated',
    'mailbox_connected',
    'mailbox_disconnected',
    'mailbox_validation_failed',
    'mailbox_token_expired',
    'mailbox_health_declined',
    'spf_missing',
    'dkim_missing',
    'dmarc_missing',
    'dns_health_declined',
    'deliverability_improved',
    'domain_warning_created',
    'warmup_started',
    'warmup_paused',
    'warmup_completed',
    'warmup_health_declined',
    'warmup_progress_milestone',
    'sequence_created',
    'sequence_started',
    'sequence_paused',
    'sequence_completed',
    'sequence_cancelled',
    'sequence_health_declined',
    'reply_detected',
    'positive_interest_detected',
    'budget_objection_detected',
    'timeline_objection_detected',
    'meeting_interest_detected',
    'unsubscribe_detected',
    'thread_owner_assigned',
    'delivery_route_changed',
    'fallback_route_triggered',
    'delivery_queued',
    'delivery_sent',
    'delivery_failed',
    'delivery_retry',
    'rate_limit_hit',
    'inbox_sync_started',
    'inbox_sync_completed',
    'inbox_reply_imported',
    'inbox_thread_matched',
    'inbox_thread_created',
    'inbox_duplicate_skipped'
  ));

-- -----------------------------------------------------------------------------
-- Extend lead timeline for inbox sync events
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
    'renewal_window_opened', 'renewal_due', 'expansion_candidate_detected', 'churn_risk_detected',
    'inbox_sync_started', 'inbox_sync_completed', 'inbox_reply_imported',
    'inbox_thread_matched', 'inbox_thread_created', 'inbox_duplicate_skipped'
  ));

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.inbox_sync_runs from public, anon, authenticated;
revoke all on table growth.inbox_provider_message_map from public, anon, authenticated;
revoke all on table growth.inbox_thread_links from public, anon, authenticated;

grant select, insert, update, delete on table growth.inbox_sync_runs to service_role;
grant select, insert, update, delete on table growth.inbox_provider_message_map to service_role;
grant select, insert, update, delete on table growth.inbox_thread_links to service_role;

alter table growth.inbox_sync_runs enable row level security;
alter table growth.inbox_provider_message_map enable row level security;
alter table growth.inbox_thread_links enable row level security;

alter table growth.inbox_sync_runs force row level security;
alter table growth.inbox_provider_message_map force row level security;
alter table growth.inbox_thread_links force row level security;

create policy growth_inbox_sync_runs_service_role
  on growth.inbox_sync_runs for all to service_role using (true) with check (true);

create policy growth_inbox_provider_message_map_service_role
  on growth.inbox_provider_message_map for all to service_role using (true) with check (true);

create policy growth_inbox_thread_links_service_role
  on growth.inbox_thread_links for all to service_role using (true) with check (true);
