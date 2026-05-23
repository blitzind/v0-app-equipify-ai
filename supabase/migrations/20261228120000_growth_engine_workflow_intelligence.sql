-- Growth Engine slice 4A: timeline, momentum, workflow health, aging, source attribution, first touch.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.leads — workflow intelligence cache + attribution + aging + first touch
-- -----------------------------------------------------------------------------

alter table growth.leads
  add column if not exists momentum_score int
    check (momentum_score is null or (momentum_score >= 0 and momentum_score <= 100)),
  add column if not exists momentum_tier text
    check (momentum_tier is null or momentum_tier in ('low', 'medium', 'high', 'critical')),
  add column if not exists momentum_why_summary text,
  add column if not exists momentum_computed_at timestamptz,
  add column if not exists workflow_health text
    check (workflow_health is null or workflow_health in ('healthy', 'needs_attention', 'stalled', 'blocked')),
  add column if not exists workflow_health_reason text,
  add column if not exists workflow_health_computed_at timestamptz,
  add column if not exists source_channel text,
  add column if not exists source_campaign text,
  add column if not exists source_import_batch_id uuid,
  add column if not exists source_vendor text,
  add column if not exists aging_days int check (aging_days is null or aging_days >= 0),
  add column if not exists aging_bucket text
    check (aging_bucket is null or aging_bucket in ('new', 'warming', 'active', 'aging', 'critical')),
  add column if not exists first_human_touch_at timestamptz,
  add column if not exists time_to_first_touch_hours numeric(10, 2);

create index if not exists idx_growth_leads_workflow_health
  on growth.leads (workflow_health, momentum_score desc nulls last);

create index if not exists idx_growth_leads_aging_bucket
  on growth.leads (aging_bucket, created_at desc);

create index if not exists idx_growth_leads_source_channel
  on growth.leads (source_channel, source_campaign);

-- -----------------------------------------------------------------------------
-- growth.lead_timeline_events — append-only workflow memory
-- -----------------------------------------------------------------------------

create table if not exists growth.lead_timeline_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,

  event_type text not null check (event_type in (
    'lead_created', 'research_started', 'research_completed', 'research_failed',
    'website_fetch_failed', 'website_fetch_fixed',
    'decision_maker_added', 'decision_maker_confirmed', 'decision_maker_rejected',
    'call_attempted', 'voicemail_left', 'interested',
    'follow_up_created', 'follow_up_completed',
    'notes_updated', 'priority_changed', 'override_changed', 'next_best_action_changed',
    'website_changed', 'status_changed', 'import_created', 'import_updated', 'manual_touch'
  )),

  title text not null,
  summary text,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_email text,

  research_run_id uuid references growth.lead_research_runs (id) on delete set null,
  call_event_id uuid references growth.lead_call_events (id) on delete set null,
  decision_maker_id uuid references growth.lead_decision_makers (id) on delete set null,

  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_lead_timeline_lead_occurred
  on growth.lead_timeline_events (lead_id, occurred_at desc);

create index if not exists idx_growth_lead_timeline_lead_type
  on growth.lead_timeline_events (lead_id, event_type, occurred_at desc);

comment on table growth.lead_timeline_events is
  'Append-only internal workflow timeline for Growth Engine leads (slice 4A).';

revoke all on table growth.lead_timeline_events from public, anon, authenticated;
grant select, insert on table growth.lead_timeline_events to service_role;

alter table growth.lead_timeline_events enable row level security;
alter table growth.lead_timeline_events force row level security;
