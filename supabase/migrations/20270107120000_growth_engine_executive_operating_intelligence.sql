-- Growth Engine slice 5.8A: executive operating intelligence cache + timeline event types.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

alter table growth.leads
  add column if not exists executive_priority_score int
    check (executive_priority_score is null or (executive_priority_score >= 0 and executive_priority_score <= 100)),
  add column if not exists executive_priority_tier text
    check (executive_priority_tier is null or executive_priority_tier in (
      'monitor', 'important', 'priority', 'executive_now'
    )),
  add column if not exists executive_priority_summary text,
  add column if not exists executive_priority_top_signals jsonb not null default '[]'::jsonb,
  add column if not exists executive_priority_volatility int not null default 0
    check (executive_priority_volatility >= 0 and executive_priority_volatility <= 100),
  add column if not exists executive_priority_previous_score int
    check (executive_priority_previous_score is null or (executive_priority_previous_score >= 0 and executive_priority_previous_score <= 100)),
  add column if not exists intelligence_conflicts jsonb not null default '[]'::jsonb,
  add column if not exists intelligence_conflict_severity_score int not null default 0
    check (intelligence_conflict_severity_score >= 0 and intelligence_conflict_severity_score <= 100),
  add column if not exists executive_recommendation text,
  add column if not exists executive_owner text,
  add column if not exists executive_intervention_opened_at timestamptz,
  add column if not exists executive_intervention_age_bucket text not null default 'new'
    check (executive_intervention_age_bucket in ('new', 'active', 'aging', 'stalled')),
  add column if not exists executive_operating_computed_at timestamptz;

create index if not exists idx_growth_leads_executive_priority_tier_score
  on growth.leads (executive_priority_tier, executive_priority_score desc nulls last);

create index if not exists idx_growth_leads_executive_intervention_age
  on growth.leads (executive_intervention_age_bucket)
  where executive_intervention_opened_at is not null;

create index if not exists idx_growth_leads_intelligence_conflict_severity
  on growth.leads (intelligence_conflict_severity_score desc)
  where intelligence_conflict_severity_score > 0;

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
    'executive_priority_changed', 'executive_intervention_recommended'
  ));
