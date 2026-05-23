-- Growth Engine slice 5.7A: revenue forecast intelligence cache + timeline event types.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

alter table growth.leads
  add column if not exists revenue_probability_score int
    check (revenue_probability_score is null or (revenue_probability_score >= 0 and revenue_probability_score <= 100)),
  add column if not exists revenue_probability_tier text
    check (revenue_probability_tier is null or revenue_probability_tier in (
      'unlikely', 'possible', 'probable', 'forecasted', 'commit_candidate'
    )),
  add column if not exists revenue_probability_summary text,
  add column if not exists revenue_probability_confidence int not null default 0
    check (revenue_probability_confidence >= 0 and revenue_probability_confidence <= 100),
  add column if not exists revenue_probability_top_signals jsonb not null default '[]'::jsonb,
  add column if not exists revenue_probability_previous_score int
    check (revenue_probability_previous_score is null or (revenue_probability_previous_score >= 0 and revenue_probability_previous_score <= 100)),
  add column if not exists revenue_trajectory text not null default 'steady'
    check (revenue_trajectory in ('accelerating', 'steady', 'slowing', 'at_risk')),
  add column if not exists revenue_probability_volatility int not null default 0
    check (revenue_probability_volatility >= 0 and revenue_probability_volatility <= 100),
  add column if not exists forecast_contribution_weight int not null default 0
    check (forecast_contribution_weight >= 0 and forecast_contribution_weight <= 100),
  add column if not exists forecast_attention_level text not null default 'none'
    check (forecast_attention_level in ('none', 'monitor', 'important', 'critical')),
  add column if not exists forecast_attention_last_changed_at timestamptz,
  add column if not exists revenue_forecast_computed_at timestamptz;

create index if not exists idx_growth_leads_revenue_probability_tier_score
  on growth.leads (revenue_probability_tier, revenue_probability_score desc nulls last);

create index if not exists idx_growth_leads_revenue_trajectory
  on growth.leads (revenue_trajectory)
  where revenue_trajectory in ('slowing', 'at_risk');

create index if not exists idx_growth_leads_forecast_attention
  on growth.leads (forecast_attention_level)
  where forecast_attention_level in ('important', 'critical');

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
    'forecast_confidence_changed', 'forecast_regression_detected'
  ));
