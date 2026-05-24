-- Growth Engine Slice 6.16A — Sequence scheduler worker.

create table if not exists growth.sequence_scheduler_runs (
  id uuid primary key default gen_random_uuid(),
  run_mode text not null check (run_mode in ('live', 'dry_run')),
  scanned int not null default 0 check (scanned >= 0),
  due int not null default 0 check (due >= 0),
  queued int not null default 0 check (queued >= 0),
  skipped_suppressed int not null default 0 check (skipped_suppressed >= 0),
  skipped_already_queued int not null default 0 check (skipped_already_queued >= 0),
  skipped_missing_draft int not null default 0 check (skipped_missing_draft >= 0),
  failed int not null default 0 check (failed >= 0),
  provider_warning boolean not null default false,
  qa_marker text not null default 'growth-sequence-scheduler-v1',
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_by text
);

create index if not exists idx_sequence_scheduler_runs_started_at
  on growth.sequence_scheduler_runs (started_at desc);

create unique index if not exists idx_outreach_queue_sequence_step_active
  on growth.outreach_queue (sequence_enrollment_step_id)
  where sequence_enrollment_step_id is not null
    and status in ('pending_approval', 'approved', 'scheduled', 'executed', 'draft');

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
    'live_call_started', 'buying_signal_detected', 'objection_detected', 'discovery_gap_detected',
    'call_risk_detected', 'live_call_completed', 'live_guidance_generated', 'live_guidance_used'
  ));

revoke all on table growth.sequence_scheduler_runs from public, anon, authenticated;
grant select, insert, update on table growth.sequence_scheduler_runs to service_role;
alter table growth.sequence_scheduler_runs enable row level security;
alter table growth.sequence_scheduler_runs force row level security;
