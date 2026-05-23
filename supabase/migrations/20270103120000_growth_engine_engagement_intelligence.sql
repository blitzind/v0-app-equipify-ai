-- Growth Engine slice 5.4A: engagement intelligence cache + timeline event types.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

alter table growth.leads
  add column if not exists engagement_score int
    check (engagement_score is null or (engagement_score >= 0 and engagement_score <= 100)),
  add column if not exists engagement_tier text
    check (engagement_tier is null or engagement_tier in ('cold', 'warming', 'engaged', 'hot')),
  add column if not exists engagement_last_activity_at timestamptz,
  add column if not exists engagement_summary text,
  add column if not exists engagement_top_signals jsonb not null default '[]'::jsonb,
  add column if not exists engagement_dormancy_exempt_until timestamptz,
  add column if not exists engagement_computed_at timestamptz;

create index if not exists idx_growth_leads_engagement_tier_score
  on growth.leads (engagement_tier, engagement_score desc nulls last);

create index if not exists idx_growth_leads_engagement_last_activity
  on growth.leads (engagement_last_activity_at desc nulls last);

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
    'engagement_score_changed', 'engagement_tier_changed', 'lead_became_hot', 'lead_became_dormant'
  ));
