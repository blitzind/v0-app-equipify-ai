-- Growth Engine slice 6.2A: Call Copilot Foundation.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

alter table growth.copilot_settings
  add column if not exists call_copilot_enabled boolean not null default true,
  add column if not exists call_copilot_require_summary_approval boolean not null default true;

create table if not exists growth.call_copilot_sessions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  call_session_id uuid references growth.lead_call_sessions (id) on delete set null,
  status text not null default 'pre_call'
    check (status in ('pre_call', 'in_call', 'completed', 'discarded')),
  live_guidance_mode text not null default 'manual'
    check (live_guidance_mode in ('manual', 'future_realtime')),
  started_at timestamptz,
  ended_at timestamptz,
  call_goal text,
  call_context_snapshot jsonb not null default '{}'::jsonb,
  live_notes text not null default '',
  detected_objections jsonb not null default '[]'::jsonb,
  detected_buying_signals jsonb not null default '[]'::jsonb,
  detected_commitment_signals jsonb not null default '[]'::jsonb,
  recommended_responses jsonb not null default '{}'::jsonb,
  post_call_summary text,
  recommended_next_step text,
  suggested_disposition text
    check (suggested_disposition is null or suggested_disposition in (
      'call_attempted', 'left_voicemail', 'interested', 'not_a_fit', 'follow_up_later', 'no_answer'
    )),
  call_outcome_confidence int not null default 0
    check (call_outcome_confidence >= 0 and call_outcome_confidence <= 100),
  post_call_generation_id uuid references growth.ai_copilot_generations (id) on delete set null,
  summary_approved_at timestamptz,
  summary_approved_by uuid references auth.users (id) on delete set null,
  disposition_approved_at timestamptz,
  disposition_approved_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_call_copilot_sessions_lead_created
  on growth.call_copilot_sessions (lead_id, created_at desc);

create index if not exists idx_call_copilot_sessions_status_updated
  on growth.call_copilot_sessions (status, updated_at desc);

create table if not exists growth.call_brief_effectiveness (
  id uuid primary key default gen_random_uuid(),
  call_copilot_session_id uuid not null references growth.call_copilot_sessions (id) on delete cascade,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  outcome text not null check (outcome in (
    'briefing_viewed', 'session_started', 'objection_captured', 'signal_captured',
    'session_completed', 'summary_approved', 'disposition_approved', 'session_discarded'
  )),
  high_risk_call boolean not null default false,
  call_outcome_confidence int not null default 0
    check (call_outcome_confidence >= 0 and call_outcome_confidence <= 100),
  effectiveness_score int not null default 0
    check (effectiveness_score >= 0 and effectiveness_score <= 100),
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_call_brief_effectiveness_session_recorded
  on growth.call_brief_effectiveness (call_copilot_session_id, recorded_at desc);

revoke all on table growth.call_copilot_sessions from public, anon, authenticated;
revoke all on table growth.call_brief_effectiveness from public, anon, authenticated;
grant select, insert, update, delete on table growth.call_copilot_sessions to service_role;
grant select, insert, update, delete on table growth.call_brief_effectiveness to service_role;
alter table growth.call_copilot_sessions enable row level security;
alter table growth.call_brief_effectiveness enable row level security;
alter table growth.call_copilot_sessions force row level security;
alter table growth.call_brief_effectiveness force row level security;

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
    'call_copilot_session_completed', 'call_copilot_summary_approved'
  ));
