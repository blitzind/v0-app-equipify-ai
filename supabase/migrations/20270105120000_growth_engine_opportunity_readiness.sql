-- Growth Engine slice 5.6A: opportunity readiness intelligence cache + timeline event types.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

alter table growth.leads
  add column if not exists opportunity_readiness_score int
    check (opportunity_readiness_score is null or (opportunity_readiness_score >= 0 and opportunity_readiness_score <= 100)),
  add column if not exists opportunity_readiness_tier text
    check (opportunity_readiness_tier is null or opportunity_readiness_tier in (
      'not_ready', 'developing', 'qualified', 'sales_ready', 'priority_opportunity'
    )),
  add column if not exists opportunity_readiness_summary text,
  add column if not exists opportunity_readiness_top_signals jsonb not null default '[]'::jsonb,
  add column if not exists opportunity_blockers jsonb not null default '[]'::jsonb,
  add column if not exists opportunity_accelerators jsonb not null default '[]'::jsonb,
  add column if not exists opportunity_readiness_trend text
    check (opportunity_readiness_trend is null or opportunity_readiness_trend in ('improving', 'stable', 'declining')),
  add column if not exists opportunity_readiness_previous_score int
    check (opportunity_readiness_previous_score is null or (opportunity_readiness_previous_score >= 0 and opportunity_readiness_previous_score <= 100)),
  add column if not exists opportunity_buying_signal_strength text not null default 'none'
    check (opportunity_buying_signal_strength in ('none', 'weak', 'moderate', 'strong')),
  add column if not exists opportunity_readiness_confidence int not null default 0
    check (opportunity_readiness_confidence >= 0 and opportunity_readiness_confidence <= 100),
  add column if not exists opportunity_age_bucket text not null default 'new'
    check (opportunity_age_bucket in ('new', 'developing', 'maturing', 'stalled')),
  add column if not exists opportunity_readiness_computed_at timestamptz;

create index if not exists idx_growth_leads_opportunity_tier_score
  on growth.leads (opportunity_readiness_tier, opportunity_readiness_score desc nulls last);

create index if not exists idx_growth_leads_opportunity_age_bucket
  on growth.leads (opportunity_age_bucket);

create index if not exists idx_growth_leads_opportunity_buying_signal
  on growth.leads (opportunity_buying_signal_strength)
  where opportunity_buying_signal_strength in ('moderate', 'strong');

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
    'opportunity_blocker_added', 'opportunity_blocker_resolved'
  ));
