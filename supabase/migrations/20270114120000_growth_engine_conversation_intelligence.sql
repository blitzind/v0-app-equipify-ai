-- Growth Engine slice 6.5A: conversation intelligence cache + timeline events.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

alter table growth.leads
  add column if not exists conversation_health_score int
    check (conversation_health_score is null or (conversation_health_score >= 0 and conversation_health_score <= 100)),
  add column if not exists conversation_health_tier text
    check (conversation_health_tier is null or conversation_health_tier in (
      'cold', 'neutral', 'positive', 'strong', 'critical'
    )),
  add column if not exists conversation_summary text,
  add column if not exists conversation_top_signals jsonb not null default '[]'::jsonb,
  add column if not exists conversation_sentiment text
    check (conversation_sentiment is null or conversation_sentiment in (
      'positive', 'neutral', 'negative', 'mixed'
    )),
  add column if not exists conversation_urgency_level text
    check (conversation_urgency_level is null or conversation_urgency_level in (
      'none', 'low', 'medium', 'high', 'critical'
    )),
  add column if not exists conversation_buying_intent text
    check (conversation_buying_intent is null or conversation_buying_intent in (
      'none', 'weak', 'moderate', 'strong', 'urgent'
    )),
  add column if not exists conversation_objection_profile jsonb not null default '{}'::jsonb,
  add column if not exists conversation_competitor_mentions jsonb not null default '[]'::jsonb,
  add column if not exists conversation_last_meaningful_conversation_at timestamptz,
  add column if not exists conversation_previous_score int
    check (conversation_previous_score is null or (conversation_previous_score >= 0 and conversation_previous_score <= 100)),
  add column if not exists conversation_trend text
    check (conversation_trend is null or conversation_trend in (
      'improving', 'stable', 'cooling', 'at_risk'
    )),
  add column if not exists conversation_confidence int
    check (conversation_confidence is null or (conversation_confidence >= 0 and conversation_confidence <= 100)),
  add column if not exists conversation_momentum text
    check (conversation_momentum is null or conversation_momentum in (
      'accelerating', 'stable', 'slowing', 'recovering', 'stalling'
    )),
  add column if not exists conversation_response_pattern text
    check (conversation_response_pattern is null or conversation_response_pattern in (
      'very_fast', 'fast', 'normal', 'slow', 'unresponsive'
    )),
  add column if not exists conversation_competitor_pressure int
    check (conversation_competitor_pressure is null or (conversation_competitor_pressure >= 0 and conversation_competitor_pressure <= 100)),
  add column if not exists conversation_computed_at timestamptz;

create index if not exists idx_growth_leads_conversation_health
  on growth.leads (conversation_health_tier, conversation_health_score desc nulls last);

create index if not exists idx_growth_leads_conversation_buying_intent
  on growth.leads (conversation_buying_intent)
  where conversation_buying_intent in ('strong', 'urgent');

create index if not exists idx_growth_leads_conversation_urgency
  on growth.leads (conversation_urgency_level)
  where conversation_urgency_level in ('high', 'critical');

create index if not exists idx_growth_leads_conversation_momentum
  on growth.leads (conversation_momentum)
  where conversation_momentum in ('stalling', 'recovering');

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
    'urgency_detected', 'conversation_risk_detected'
  ));
