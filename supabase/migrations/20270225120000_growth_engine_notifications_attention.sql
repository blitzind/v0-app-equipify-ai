-- Growth Engine Slice 6.18A — Notifications + attention layer.

create table if not exists growth.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  owner_user_id uuid references auth.users (id) on delete set null,
  lead_id uuid references growth.leads (id) on delete set null,
  opportunity_id uuid,
  notification_type text not null,
  severity text not null check (severity in ('critical', 'high', 'medium', 'low')),
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  source_system text not null,
  source_id text,
  deterministic_hash text not null,
  priority_score int not null default 0 check (priority_score >= 0 and priority_score <= 1000),
  action_url text,
  collapse_count int not null default 1 check (collapse_count >= 1),
  qa_marker text not null default 'growth-notifications-v1'
);

create index if not exists idx_growth_notifications_owner_open
  on growth.notifications (owner_user_id, priority_score desc, created_at desc)
  where completed_at is null
    and (expires_at is null or expires_at > now());

create index if not exists idx_growth_notifications_lead
  on growth.notifications (lead_id, created_at desc)
  where lead_id is not null;

create index if not exists idx_growth_notifications_type
  on growth.notifications (notification_type, created_at desc);

create index if not exists idx_growth_notifications_hash
  on growth.notifications (deterministic_hash, created_at desc);

create unique index if not exists idx_growth_notifications_active_hash
  on growth.notifications (deterministic_hash)
  where completed_at is null
    and (expires_at is null or expires_at > now());

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
    'call_risk_detected', 'live_call_completed', 'live_guidance_generated', 'live_guidance_used'
  ));

revoke all on table growth.notifications from public, anon, authenticated;
grant select, insert, update on table growth.notifications to service_role;
alter table growth.notifications enable row level security;
alter table growth.notifications force row level security;
