-- Growth Engine Phase 2B — Unified Inbox + Reply Intelligence (orchestration only, no mailbox sync).

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
  if to_regclass('growth.platform_timeline_events') is null then
    raise exception 'Missing dependency: growth.platform_timeline_events';
  end if;
  if to_regclass('growth.mailbox_connections') is null then
    raise exception 'Missing dependency: growth.mailbox_connections';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.inbox_threads
-- -----------------------------------------------------------------------------

create table if not exists growth.inbox_threads (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  provider_family text not null default 'custom',
  mailbox_connection_id uuid references growth.mailbox_connections (id) on delete set null,
  subject text not null default '',
  thread_status text not null default 'open'
    check (thread_status in ('open', 'waiting', 'needs_review', 'resolved', 'archived')),
  reply_count integer not null default 0 check (reply_count >= 0),
  last_message_at timestamptz,
  owner_user_id uuid,
  priority_score integer not null default 0 check (priority_score >= 0 and priority_score <= 100),
  priority_tier text not null default 'normal'
    check (priority_tier in ('low', 'normal', 'high', 'critical')),
  classification text not null default 'unknown'
    check (classification in (
      'unknown',
      'positive_interest',
      'question',
      'budget',
      'timeline',
      'competitor',
      'not_interested',
      'unsubscribe',
      'meeting_intent',
      'referral'
    )),
  classification_confidence integer not null default 0 check (classification_confidence >= 0 and classification_confidence <= 100),
  requires_human_review boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_inbox_threads_lead
  on growth.inbox_threads (lead_id);

create index if not exists idx_growth_inbox_threads_status
  on growth.inbox_threads (thread_status);

create index if not exists idx_growth_inbox_threads_priority
  on growth.inbox_threads (priority_score desc);

create index if not exists idx_growth_inbox_threads_last_message
  on growth.inbox_threads (last_message_at desc nulls last);

comment on table growth.inbox_threads is
  'Unified inbox thread ownership and reply intelligence — no mailbox polling in Phase 2B.';

-- -----------------------------------------------------------------------------
-- growth.inbox_messages
-- -----------------------------------------------------------------------------

create table if not exists growth.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references growth.inbox_threads (id) on delete cascade,
  direction text not null default 'inbound'
    check (direction in ('inbound', 'outbound')),
  sender text not null default '',
  recipient text not null default '',
  subject text not null default '',
  body_preview text not null default '',
  provider_message_id text,
  message_timestamp timestamptz not null default now(),
  contains_competitor boolean not null default false,
  contains_pricing boolean not null default false,
  contains_budget boolean not null default false,
  contains_meeting_language boolean not null default false,
  contains_positive_signal boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_inbox_messages_thread
  on growth.inbox_messages (thread_id, message_timestamp desc);

create index if not exists idx_growth_inbox_messages_timestamp
  on growth.inbox_messages (message_timestamp desc);

comment on table growth.inbox_messages is
  'Thread messages with deterministic signal flags — manually ingested only in Phase 2B.';

-- -----------------------------------------------------------------------------
-- growth.reply_intelligence_events
-- -----------------------------------------------------------------------------

create table if not exists growth.reply_intelligence_events (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references growth.inbox_threads (id) on delete cascade,
  severity text not null default 'low'
    check (severity in ('low', 'medium', 'high', 'critical')),
  event_type text not null default 'reply_detected',
  title text not null default '',
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_reply_intelligence_events_thread
  on growth.reply_intelligence_events (thread_id, created_at desc);

create index if not exists idx_growth_reply_intelligence_events_created
  on growth.reply_intelligence_events (created_at desc);

comment on table growth.reply_intelligence_events is
  'Reply intelligence event feed for unified inbox monitoring.';

-- -----------------------------------------------------------------------------
-- Extend platform timeline for inbox / reply intelligence events
-- -----------------------------------------------------------------------------

alter table growth.platform_timeline_events
  drop constraint if exists platform_timeline_events_event_type_check;

alter table growth.platform_timeline_events
  add constraint platform_timeline_events_event_type_check
  check (event_type in (
    'provider_connected',
    'provider_validation_failed',
    'provider_disabled',
    'provider_reconnected',
    'sender_connected',
    'sender_disabled',
    'sender_score_changed',
    'domain_health_declined',
    'domain_validated',
    'mailbox_connected',
    'mailbox_disconnected',
    'mailbox_validation_failed',
    'mailbox_token_expired',
    'mailbox_health_declined',
    'spf_missing',
    'dkim_missing',
    'dmarc_missing',
    'dns_health_declined',
    'deliverability_improved',
    'domain_warning_created',
    'warmup_started',
    'warmup_paused',
    'warmup_completed',
    'warmup_health_declined',
    'warmup_progress_milestone',
    'sequence_created',
    'sequence_started',
    'sequence_paused',
    'sequence_completed',
    'sequence_cancelled',
    'sequence_health_declined',
    'reply_detected',
    'positive_interest_detected',
    'budget_objection_detected',
    'timeline_objection_detected',
    'meeting_interest_detected',
    'unsubscribe_detected',
    'thread_owner_assigned'
  ));

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.inbox_threads from public, anon, authenticated;
revoke all on table growth.inbox_messages from public, anon, authenticated;
revoke all on table growth.reply_intelligence_events from public, anon, authenticated;

grant select, insert, update, delete on table growth.inbox_threads to service_role;
grant select, insert, update, delete on table growth.inbox_messages to service_role;
grant select, insert, update, delete on table growth.reply_intelligence_events to service_role;

alter table growth.inbox_threads enable row level security;
alter table growth.inbox_messages enable row level security;
alter table growth.reply_intelligence_events enable row level security;

alter table growth.inbox_threads force row level security;
alter table growth.inbox_messages force row level security;
alter table growth.reply_intelligence_events force row level security;

create policy growth_inbox_threads_service_role
  on growth.inbox_threads for all to service_role using (true) with check (true);

create policy growth_inbox_messages_service_role
  on growth.inbox_messages for all to service_role using (true) with check (true);

create policy growth_reply_intelligence_events_service_role
  on growth.reply_intelligence_events for all to service_role using (true) with check (true);
