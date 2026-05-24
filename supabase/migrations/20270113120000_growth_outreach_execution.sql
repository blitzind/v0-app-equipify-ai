-- Growth Engine slice 6.4A: outreach execution layer (controlled send queue).

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
  if to_regclass('growth.ai_copilot_generations') is null then
    raise exception 'Missing dependency: growth.ai_copilot_generations';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.outreach_queue
-- -----------------------------------------------------------------------------

create table if not exists growth.outreach_queue (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  generation_id uuid references growth.ai_copilot_generations (id) on delete set null,
  campaign_id uuid references growth.outbound_campaigns (id) on delete set null,
  channel text not null check (channel in ('email', 'manual_call', 'manual_follow_up')),
  status text not null default 'pending_approval'
    check (status in ('draft', 'pending_approval', 'approved', 'scheduled', 'executed', 'failed', 'cancelled')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'critical')),
  execution_confidence int not null default 50 check (execution_confidence >= 0 and execution_confidence <= 100),
  scheduled_for timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  approval_note text,
  executed_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  provider_connection_id uuid references growth.email_provider_connections (id) on delete set null,
  outbound_message_id uuid references growth.outbound_messages (id) on delete set null,
  payload_snapshot jsonb not null default '{}'::jsonb,
  generation_version int not null default 1 check (generation_version >= 1),
  parent_queue_id uuid references growth.outreach_queue (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_outreach_queue_status_scheduled
  on growth.outreach_queue (status, scheduled_for nulls last);

create index if not exists idx_growth_outreach_queue_lead
  on growth.outreach_queue (lead_id, created_at desc);

create index if not exists idx_growth_outreach_queue_generation
  on growth.outreach_queue (generation_id)
  where generation_id is not null;

create index if not exists idx_growth_outreach_queue_priority
  on growth.outreach_queue (priority, status);

-- -----------------------------------------------------------------------------
-- growth.outreach_queue_events
-- -----------------------------------------------------------------------------

create table if not exists growth.outreach_queue_events (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references growth.outreach_queue (id) on delete cascade,
  event_type text not null check (event_type in (
    'queued', 'approved', 'scheduled', 'regenerated', 'execution_started',
    'executed', 'failed', 'cancelled'
  )),
  actor_user_id uuid references auth.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_outreach_queue_events_queue
  on growth.outreach_queue_events (queue_id, created_at desc);

-- -----------------------------------------------------------------------------
-- growth.outreach_settings
-- -----------------------------------------------------------------------------

create table if not exists growth.outreach_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique,
  timezone text not null default 'America/New_York',
  business_hours_start_minutes int not null default 540 check (business_hours_start_minutes >= 0 and business_hours_start_minutes < 1440),
  business_hours_end_minutes int not null default 1020 check (business_hours_end_minutes > 0 and business_hours_end_minutes <= 1440),
  respect_business_hours boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into growth.outreach_settings (singleton)
select true
where not exists (select 1 from growth.outreach_settings where singleton = true);

-- -----------------------------------------------------------------------------
-- ai_copilot_generations — allow sent_at when outreach executed
-- -----------------------------------------------------------------------------

alter table growth.ai_copilot_generations
  add column if not exists outreach_queue_id uuid references growth.outreach_queue (id) on delete set null;

alter table growth.ai_copilot_generations
  drop constraint if exists ai_copilot_generations_sent_at_check;

-- -----------------------------------------------------------------------------
-- growth.lead_timeline_events — outreach execution events
-- -----------------------------------------------------------------------------

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
    'outreach_queued', 'outreach_approved', 'outreach_executed', 'outreach_failed', 'outreach_cancelled'
  ));

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table growth.outreach_queue enable row level security;
alter table growth.outreach_queue force row level security;
alter table growth.outreach_queue_events enable row level security;
alter table growth.outreach_queue_events force row level security;
alter table growth.outreach_settings enable row level security;
alter table growth.outreach_settings force row level security;

revoke all on growth.outreach_queue from public, anon, authenticated;
revoke all on growth.outreach_queue_events from public, anon, authenticated;
revoke all on growth.outreach_settings from public, anon, authenticated;

grant select, insert, update, delete on growth.outreach_queue to service_role;
grant select, insert, update, delete on growth.outreach_queue_events to service_role;
grant select, insert, update, delete on growth.outreach_settings to service_role;
