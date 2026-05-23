-- Growth Engine slice 5.5A: relationship intelligence cache + timeline event types.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

alter table growth.leads
  add column if not exists relationship_strength_score int
    check (relationship_strength_score is null or (relationship_strength_score >= 0 and relationship_strength_score <= 100)),
  add column if not exists relationship_strength_tier text
    check (relationship_strength_tier is null or relationship_strength_tier in (
      'unknown', 'developing', 'active', 'trusted', 'strategic'
    )),
  add column if not exists relationship_last_meaningful_touch_at timestamptz,
  add column if not exists relationship_summary text,
  add column if not exists relationship_top_signals jsonb not null default '[]'::jsonb,
  add column if not exists relationship_trend text
    check (relationship_trend is null or relationship_trend in ('improving', 'stable', 'cooling')),
  add column if not exists relationship_previous_score int
    check (relationship_previous_score is null or (relationship_previous_score >= 0 and relationship_previous_score <= 100)),
  add column if not exists relationship_owner_attention_level text not null default 'none'
    check (relationship_owner_attention_level in ('none', 'recommended', 'important', 'critical')),
  add column if not exists relationship_recovery_attempt_count int not null default 0
    check (relationship_recovery_attempt_count >= 0),
  add column if not exists relationship_computed_at timestamptz;

create index if not exists idx_growth_leads_relationship_tier_score
  on growth.leads (relationship_strength_tier, relationship_strength_score desc nulls last);

create index if not exists idx_growth_leads_relationship_last_touch
  on growth.leads (relationship_last_meaningful_touch_at desc nulls last);

create index if not exists idx_growth_leads_relationship_trend
  on growth.leads (relationship_trend)
  where relationship_trend = 'cooling';

create index if not exists idx_growth_leads_relationship_owner_attention
  on growth.leads (relationship_owner_attention_level)
  where relationship_owner_attention_level in ('important', 'critical');

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
    'relationship_cooled'
  ));
