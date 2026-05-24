-- Growth Engine slice 6.9A: Realtime Call Intelligence foundation.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
  if to_regclass('growth.call_copilot_sessions') is null then
    raise exception 'Missing dependency: growth.call_copilot_sessions';
  end if;
end;
$$;

create table if not exists growth.realtime_call_sessions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  call_copilot_session_id uuid references growth.call_copilot_sessions (id) on delete set null,
  status text not null default 'preparing'
    check (status in ('preparing', 'active', 'paused', 'completed', 'discarded')),
  started_at timestamptz,
  ended_at timestamptz,
  live_guidance_mode text not null default 'manual'
    check (live_guidance_mode in ('manual', 'future_realtime')),
  transcript_status text not null default 'inactive'
    check (transcript_status in ('inactive', 'connecting', 'live', 'failed')),
  guidance_enabled boolean not null default true,
  risk_monitoring_enabled boolean not null default true,
  live_snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_realtime_call_sessions_lead_created
  on growth.realtime_call_sessions (lead_id, created_at desc);

create index if not exists idx_realtime_call_sessions_status_updated
  on growth.realtime_call_sessions (status, updated_at desc);

create table if not exists growth.realtime_call_transcript_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references growth.realtime_call_sessions (id) on delete cascade,
  speaker text not null check (speaker in ('rep', 'prospect', 'system')),
  content text not null,
  sequence_number int not null check (sequence_number >= 0),
  timestamp_ms bigint not null default 0 check (timestamp_ms >= 0),
  created_at timestamptz not null default now(),
  unique (session_id, sequence_number)
);

create index if not exists idx_realtime_call_transcript_events_session_seq
  on growth.realtime_call_transcript_events (session_id, sequence_number);

revoke all on table growth.realtime_call_sessions from public, anon, authenticated;
revoke all on table growth.realtime_call_transcript_events from public, anon, authenticated;
grant select, insert, update, delete on table growth.realtime_call_sessions to service_role;
grant select, insert, update, delete on table growth.realtime_call_transcript_events to service_role;
alter table growth.realtime_call_sessions enable row level security;
alter table growth.realtime_call_transcript_events enable row level security;
alter table growth.realtime_call_sessions force row level security;
alter table growth.realtime_call_transcript_events force row level security;

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
    'conversation_health_changed', 'buying_intent_detected', 'competitor_detected',
    'urgency_detected', 'conversation_risk_detected',
    'sequence_pattern_detected', 'sequence_recommendation_changed',
    'sequence_enrollment_created', 'sequence_step_created', 'sequence_step_queued',
    'sequence_step_executed', 'sequence_enrollment_completed', 'sequence_enrollment_cancelled',
    'outreach_queued', 'outreach_approved', 'outreach_executed', 'outreach_failed', 'outreach_cancelled',
    'live_call_started', 'buying_signal_detected', 'objection_detected',
    'discovery_gap_detected', 'call_risk_detected', 'live_call_completed'
  ));
