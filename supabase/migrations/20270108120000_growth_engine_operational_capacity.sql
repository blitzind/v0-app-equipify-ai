-- Growth Engine slice 5.9A: operational capacity intelligence cache + timeline event types.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

alter table growth.leads
  add column if not exists operational_capacity_score int
    check (operational_capacity_score is null or (operational_capacity_score >= 0 and operational_capacity_score <= 100)),
  add column if not exists operational_capacity_tier text
    check (operational_capacity_tier is null or operational_capacity_tier in (
      'healthy', 'strained', 'constrained', 'critical'
    )),
  add column if not exists operational_capacity_summary text,
  add column if not exists operational_capacity_top_constraints jsonb not null default '[]'::jsonb,
  add column if not exists capacity_pressure_level int not null default 0
    check (capacity_pressure_level >= 0 and capacity_pressure_level <= 100),
  add column if not exists capacity_pressure_volatility int not null default 0
    check (capacity_pressure_volatility >= 0 and capacity_pressure_volatility <= 100),
  add column if not exists protected_pipeline_coverage int not null default 0
    check (protected_pipeline_coverage >= 0 and protected_pipeline_coverage <= 100),
  add column if not exists operational_constraints jsonb not null default '[]'::jsonb,
  add column if not exists capacity_conflicts jsonb not null default '[]'::jsonb,
  add column if not exists capacity_protection_recommendation text,
  add column if not exists constraint_opened_at timestamptz,
  add column if not exists constraint_age_bucket text not null default 'new'
    check (constraint_age_bucket in ('new', 'active', 'aging', 'stalled')),
  add column if not exists capacity_recovery_direction text not null default 'stable'
    check (capacity_recovery_direction in ('recovering', 'stable', 'worsening')),
  add column if not exists operational_capacity_previous_score int
    check (operational_capacity_previous_score is null or (operational_capacity_previous_score >= 0 and operational_capacity_previous_score <= 100)),
  add column if not exists operational_capacity_computed_at timestamptz;

create index if not exists idx_growth_leads_operational_capacity_tier_score
  on growth.leads (operational_capacity_tier, operational_capacity_score asc nulls last);

create index if not exists idx_growth_leads_capacity_pressure
  on growth.leads (capacity_pressure_level desc)
  where capacity_pressure_level > 50;

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
    'operational_risk_detected'
  ));
