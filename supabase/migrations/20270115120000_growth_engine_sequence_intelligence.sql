-- Growth Engine slice 6.6A: sequence intelligence (pattern catalog + outcomes + lead recommendations).

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

create table if not exists growth.sequence_patterns (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  description text,
  pattern_kind text not null default 'catalog'
    check (pattern_kind in ('catalog', 'detected')),
  sequence_version int not null default 1 check (sequence_version >= 1),
  is_active boolean not null default true,
  min_touches int not null default 1 check (min_touches >= 1),
  max_observation_days int not null default 90 check (max_observation_days >= 1),
  attempt_count int not null default 0 check (attempt_count >= 0),
  reply_rate numeric not null default 0 check (reply_rate >= 0 and reply_rate <= 1),
  positive_reply_rate numeric not null default 0 check (positive_reply_rate >= 0 and positive_reply_rate <= 1),
  meeting_signal_rate numeric not null default 0 check (meeting_signal_rate >= 0 and meeting_signal_rate <= 1),
  follow_up_completion_rate numeric not null default 0 check (follow_up_completion_rate >= 0 and follow_up_completion_rate <= 1),
  sequence_abandonment_rate numeric not null default 0 check (sequence_abandonment_rate >= 0 and sequence_abandonment_rate <= 1),
  opportunity_lift numeric not null default 0,
  revenue_probability_lift numeric not null default 0,
  conversation_health_lift numeric not null default 0,
  average_time_to_reply_hours numeric,
  average_touches_to_positive_signal numeric,
  sequence_quality_score int not null default 0 check (sequence_quality_score >= 0 and sequence_quality_score <= 100),
  sequence_fatigue_risk text not null default 'none'
    check (sequence_fatigue_risk in ('none', 'low', 'medium', 'high')),
  confidence_score int not null default 0 check (confidence_score >= 0 and confidence_score <= 100),
  computed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists growth.sequence_pattern_steps (
  id uuid primary key default gen_random_uuid(),
  pattern_id uuid not null references growth.sequence_patterns (id) on delete cascade,
  step_order int not null check (step_order >= 1),
  channel text not null check (channel in ('email', 'manual_call', 'manual_follow_up')),
  delay_days_min int not null default 0 check (delay_days_min >= 0),
  delay_days_max int not null default 14 check (delay_days_max >= delay_days_min),
  generation_type text,
  playbook_category text,
  required_human_approval boolean not null default true,
  expected_signal text not null default 'no_signal'
    check (expected_signal in (
      'reply', 'positive_reply', 'call_connected', 'meeting_signal',
      'follow_up_completed', 'no_signal'
    )),
  created_at timestamptz not null default now(),
  unique (pattern_id, step_order)
);

create table if not exists growth.sequence_pattern_outcomes (
  id uuid primary key default gen_random_uuid(),
  pattern_id uuid not null references growth.sequence_patterns (id) on delete cascade,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  started_at timestamptz not null,
  completed_at timestamptz,
  detection_source text not null default 'touch_reconstruction'
    check (detection_source in ('outreach_queue', 'touch_reconstruction')),
  touch_ids jsonb not null default '[]'::jsonb,
  outcome_window_days int not null default 30 check (outcome_window_days >= 1),
  got_reply boolean not null default false,
  got_positive_reply boolean not null default false,
  got_meeting_signal boolean not null default false,
  follow_up_completed boolean not null default false,
  abandoned boolean not null default false,
  time_to_reply_hours numeric,
  touches_to_positive_signal int,
  opportunity_score_before int,
  opportunity_score_after int,
  revenue_probability_before int,
  revenue_probability_after int,
  conversation_health_before int,
  conversation_health_after int,
  lead_industry_bucket text,
  dominant_objection_key text,
  buying_intent_at_start text,
  created_at timestamptz not null default now(),
  unique (pattern_id, lead_id, started_at)
);

create index if not exists idx_sequence_pattern_outcomes_pattern
  on growth.sequence_pattern_outcomes (pattern_id, started_at desc);

create index if not exists idx_sequence_pattern_outcomes_lead
  on growth.sequence_pattern_outcomes (lead_id, started_at desc);

alter table growth.leads
  add column if not exists recommended_sequence_pattern_id uuid references growth.sequence_patterns (id) on delete set null,
  add column if not exists recommended_sequence_reason text,
  add column if not exists recommended_sequence_confidence int
    check (recommended_sequence_confidence is null or (recommended_sequence_confidence >= 0 and recommended_sequence_confidence <= 100)),
  add column if not exists recommended_sequence_next_step jsonb not null default '{}'::jsonb,
  add column if not exists sequence_fatigue_risk text
    check (sequence_fatigue_risk is null or sequence_fatigue_risk in ('none', 'low', 'medium', 'high')),
  add column if not exists recommended_sequence_computed_at timestamptz;

alter table growth.outreach_queue
  add column if not exists sequence_pattern_id uuid references growth.sequence_patterns (id) on delete set null;

create index if not exists idx_growth_leads_recommended_sequence
  on growth.leads (recommended_sequence_pattern_id)
  where recommended_sequence_pattern_id is not null;

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
    'sequence_pattern_detected', 'sequence_recommendation_changed'
  ));

revoke all on table growth.sequence_patterns from public, anon, authenticated;
revoke all on table growth.sequence_pattern_steps from public, anon, authenticated;
revoke all on table growth.sequence_pattern_outcomes from public, anon, authenticated;
grant select, insert, update, delete on table growth.sequence_patterns to service_role;
grant select, insert, update, delete on table growth.sequence_pattern_steps to service_role;
grant select, insert, update, delete on table growth.sequence_pattern_outcomes to service_role;
alter table growth.sequence_patterns enable row level security;
alter table growth.sequence_pattern_steps enable row level security;
alter table growth.sequence_pattern_outcomes enable row level security;
alter table growth.sequence_patterns force row level security;
alter table growth.sequence_pattern_steps force row level security;
alter table growth.sequence_pattern_outcomes force row level security;

insert into growth.sequence_patterns (key, label, description, min_touches, sequence_version)
values
  ('cold_email_only', 'Cold email only', 'Single cold outreach email with no prior touches.', 1, 1),
  ('email_then_call', 'Email then call', 'Email followed by manual call within 3–7 days.', 2, 1),
  ('call_then_email', 'Call then email', 'Manual call followed by follow-up email within 1–3 days.', 2, 1),
  ('follow_up_after_reply', 'Follow-up after reply', 'Follow-up email after a prospect reply.', 2, 1),
  ('executive_follow_up', 'Executive follow-up', 'Executive email followed by manual follow-up.', 2, 1),
  ('reengagement_sequence', 'Reengagement sequence', 'Reengagement email then call for dormant leads.', 2, 1)
on conflict (key) do nothing;

insert into growth.sequence_pattern_steps (
  pattern_id, step_order, channel, delay_days_min, delay_days_max, generation_type, expected_signal
)
select p.id, s.step_order, s.channel, s.delay_days_min, s.delay_days_max, s.generation_type, s.expected_signal
from growth.sequence_patterns p
join (
  values
    ('cold_email_only', 1, 'email', 0, 0, 'cold_email', 'reply'),
    ('email_then_call', 1, 'email', 0, 0, 'cold_email', 'reply'),
    ('email_then_call', 2, 'manual_call', 3, 7, null, 'call_connected'),
    ('call_then_email', 1, 'manual_call', 0, 0, null, 'call_connected'),
    ('call_then_email', 2, 'email', 1, 3, 'follow_up_email', 'reply'),
    ('follow_up_after_reply', 1, 'email', 1, 5, 'follow_up_email', 'positive_reply'),
    ('executive_follow_up', 1, 'email', 0, 0, 'executive_email', 'reply'),
    ('executive_follow_up', 2, 'manual_follow_up', 2, 7, null, 'follow_up_completed'),
    ('reengagement_sequence', 1, 'email', 0, 0, 'reengagement_email', 'reply'),
    ('reengagement_sequence', 2, 'manual_call', 5, 14, null, 'positive_reply')
) as s(pattern_key, step_order, channel, delay_days_min, delay_days_max, generation_type, expected_signal)
  on p.key = s.pattern_key
on conflict (pattern_id, step_order) do nothing;
