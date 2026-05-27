-- Growth Engine Phase 2K — Inbox assignment + team ownership.
-- Team-managed revenue queue with SLA, handoff, and deterministic suggestions.
-- No autonomous replies or auto-assignment by default.

do $$
begin
  if to_regclass('growth.inbox_threads') is null then
    raise exception 'Missing dependency: growth.inbox_threads';
  end if;
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Extend inbox_threads for ownership metadata + SLA
-- -----------------------------------------------------------------------------

alter table growth.inbox_threads
  add column if not exists assigned_at timestamptz,
  add column if not exists assigned_by uuid,
  add column if not exists assignment_source text,
  add column if not exists sla_due_at timestamptz,
  add column if not exists handoff_note text;

create index if not exists idx_growth_inbox_threads_owner_status
  on growth.inbox_threads (owner_user_id, thread_status, last_message_at desc);

create index if not exists idx_growth_inbox_threads_sla_due
  on growth.inbox_threads (sla_due_at)
  where sla_due_at is not null and thread_status in ('open', 'waiting', 'needs_review');

-- -----------------------------------------------------------------------------
-- growth.inbox_assignment_settings (singleton)
-- -----------------------------------------------------------------------------

create table if not exists growth.inbox_assignment_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique,
  auto_assign_enabled boolean not null default false,
  sla_alerts_enabled boolean not null default true,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into growth.inbox_assignment_settings (singleton)
select true
where not exists (select 1 from growth.inbox_assignment_settings where singleton = true);

comment on table growth.inbox_assignment_settings is
  'Inbox team ownership settings — auto-assign disabled by default.';

-- -----------------------------------------------------------------------------
-- growth.inbox_assignment_rules
-- -----------------------------------------------------------------------------

create table if not exists growth.inbox_assignment_rules (
  id uuid primary key default gen_random_uuid(),
  enabled boolean not null default true,
  priority_order integer not null default 100,
  rule_type text not null default 'lead_owner'
    check (rule_type in ('lead_owner', 'specific_rep', 'round_robin', 'classification')),
  classification text,
  priority_tier text,
  target_user_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_inbox_assignment_rules_order
  on growth.inbox_assignment_rules (priority_order asc, created_at asc);

comment on table growth.inbox_assignment_rules is
  'Deterministic inbox owner suggestion rules — suggestions only unless auto_assign enabled.';

-- -----------------------------------------------------------------------------
-- growth.inbox_thread_owner_history
-- -----------------------------------------------------------------------------

create table if not exists growth.inbox_thread_owner_history (
  id uuid primary key default gen_random_uuid(),
  inbox_thread_id uuid not null references growth.inbox_threads (id) on delete cascade,
  action text not null
    check (action in ('assigned', 'claimed', 'handoff', 'unassigned')),
  from_user_id uuid,
  to_user_id uuid,
  handoff_note text,
  assignment_source text,
  actor_user_id uuid not null,
  actor_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_inbox_thread_owner_history_thread
  on growth.inbox_thread_owner_history (inbox_thread_id, created_at desc);

comment on table growth.inbox_thread_owner_history is
  'Append-only inbox thread ownership history with handoff notes.';

-- -----------------------------------------------------------------------------
-- Extend platform timeline for inbox team ownership events
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
    'thread_owner_assigned',
    'thread_claimed',
    'thread_handoff',
    'thread_unassigned',
    'thread_sla_overdue',
    'inbox_assignment_rule_applied',
    'delivery_route_changed',
    'fallback_route_triggered',
    'delivery_queued',
    'delivery_sent',
    'delivery_failed',
    'delivery_retry',
    'rate_limit_hit',
    'inbox_sync_started',
    'inbox_sync_completed',
    'inbox_reply_imported',
    'inbox_thread_matched',
    'inbox_thread_created',
    'inbox_duplicate_skipped',
    'reply_draft_generated',
    'reply_draft_approved',
    'reply_draft_discarded',
    'reply_draft_sent',
    'reply_draft_blocked'
  ));

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.inbox_assignment_settings from public, anon, authenticated;
revoke all on table growth.inbox_assignment_rules from public, anon, authenticated;
revoke all on table growth.inbox_thread_owner_history from public, anon, authenticated;

grant select, insert, update, delete on table growth.inbox_assignment_settings to service_role;
grant select, insert, update, delete on table growth.inbox_assignment_rules to service_role;
grant select, insert, update, delete on table growth.inbox_thread_owner_history to service_role;

alter table growth.inbox_assignment_settings enable row level security;
alter table growth.inbox_assignment_rules enable row level security;
alter table growth.inbox_thread_owner_history enable row level security;

alter table growth.inbox_assignment_settings force row level security;
alter table growth.inbox_assignment_rules force row level security;
alter table growth.inbox_thread_owner_history force row level security;

create policy growth_inbox_assignment_settings_service_role
  on growth.inbox_assignment_settings for all to service_role using (true) with check (true);

create policy growth_inbox_assignment_rules_service_role
  on growth.inbox_assignment_rules for all to service_role using (true) with check (true);

create policy growth_inbox_thread_owner_history_service_role
  on growth.inbox_thread_owner_history for all to service_role using (true) with check (true);
