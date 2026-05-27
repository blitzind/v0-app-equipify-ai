-- Growth Engine Phase 2P — Multi-channel sequence orchestration.
-- Human tasks for non-email channels — no autonomous SMS, LinkedIn, calls, or voicemail drops.

do $$
begin
  if to_regclass('growth.sequence_enrollments') is null then
    raise exception 'Missing dependency: growth.sequence_enrollments';
  end if;
  if to_regclass('growth.sequence_enrollment_steps') is null then
    raise exception 'Missing dependency: growth.sequence_enrollment_steps';
  end if;
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.sequence_channel_tasks
-- -----------------------------------------------------------------------------

create table if not exists growth.sequence_channel_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  sequence_enrollment_id uuid not null references growth.sequence_enrollments (id) on delete cascade,
  sequence_step_id uuid,
  channel text not null
    check (channel in (
      'email', 'manual_call', 'manual_followup', 'linkedin_manual',
      'sms_future', 'booking_followup', 'voicemail_future'
    )),
  status text not null default 'pending'
    check (status in (
      'pending', 'approved', 'in_progress', 'completed', 'skipped', 'blocked', 'failed'
    )),
  title text not null default '',
  description text not null default '',
  evidence_snippet text not null default '',
  requires_human_approval boolean not null default true,
  approved_by uuid,
  completed_by uuid,
  skipped_by uuid,
  booking_recommendation_id uuid,
  sequence_execution_job_id uuid,
  call_workspace_href text,
  scheduled_for timestamptz,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_sequence_channel_tasks_lead
  on growth.sequence_channel_tasks (lead_id, status, scheduled_for desc nulls last);

create index if not exists idx_growth_sequence_channel_tasks_enrollment
  on growth.sequence_channel_tasks (sequence_enrollment_id, sequence_step_id, status);

create index if not exists idx_growth_sequence_channel_tasks_channel
  on growth.sequence_channel_tasks (channel, status, created_at desc);

comment on table growth.sequence_channel_tasks is
  'Multi-channel sequence tasks — non-email channels are human tasks only; email uses safe execution transport.';

-- -----------------------------------------------------------------------------
-- growth.sequence_channel_task_events
-- -----------------------------------------------------------------------------

create table if not exists growth.sequence_channel_task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references growth.sequence_channel_tasks (id) on delete cascade,
  lead_id uuid references growth.leads (id) on delete set null,
  event_type text not null,
  severity text not null default 'info'
    check (severity in ('info', 'low', 'medium', 'high', 'critical')),
  title text not null default '',
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_sequence_channel_task_events_task
  on growth.sequence_channel_task_events (task_id, created_at desc);

comment on table growth.sequence_channel_task_events is
  'Audit trail for multi-channel sequence tasks — no provider payloads.';

-- -----------------------------------------------------------------------------
-- growth.channel_performance_snapshots
-- -----------------------------------------------------------------------------

create table if not exists growth.channel_performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  task_id uuid references growth.sequence_channel_tasks (id) on delete set null,
  channel text not null
    check (channel in (
      'email', 'manual_call', 'manual_followup', 'linkedin_manual',
      'sms_future', 'booking_followup', 'voicemail_future'
    )),
  metric_type text not null default 'task_completed',
  metric_value numeric not null default 1,
  attribution_weight numeric not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_channel_performance_snapshots_channel
  on growth.channel_performance_snapshots (channel, recorded_at desc);

create index if not exists idx_growth_channel_performance_snapshots_lead
  on growth.channel_performance_snapshots (lead_id, recorded_at desc);

comment on table growth.channel_performance_snapshots is
  'Channel performance attribution snapshots — read-only analytics foundation.';

-- -----------------------------------------------------------------------------
-- growth.channel_routing_rules
-- -----------------------------------------------------------------------------

create table if not exists growth.channel_routing_rules (
  id uuid primary key default gen_random_uuid(),
  channel text not null
    check (channel in (
      'email', 'manual_call', 'manual_followup', 'linkedin_manual',
      'sms_future', 'booking_followup', 'voicemail_future'
    )),
  label text not null default '',
  priority integer not null default 100,
  is_active boolean not null default true,
  requires_approval boolean not null default true,
  is_future_placeholder boolean not null default false,
  match_criteria jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_channel_routing_rules_active
  on growth.channel_routing_rules (is_active, priority asc);

comment on table growth.channel_routing_rules is
  'Channel routing rules — future channels blocked until compliance/provider phase.';

-- Default routing rules
insert into growth.channel_routing_rules (channel, label, priority, requires_approval, is_future_placeholder, match_criteria)
select 'email', 'Email via safe execution', 10, true, false, '{"transport":"safe_execution"}'::jsonb
where not exists (select 1 from growth.channel_routing_rules where channel = 'email' and label = 'Email via safe execution');

insert into growth.channel_routing_rules (channel, label, priority, requires_approval, is_future_placeholder, match_criteria)
select 'manual_call', 'Manual call task', 20, true, false, '{"workspace":"call_workspace"}'::jsonb
where not exists (select 1 from growth.channel_routing_rules where channel = 'manual_call' and label = 'Manual call task');

insert into growth.channel_routing_rules (channel, label, priority, requires_approval, is_future_placeholder, match_criteria)
select 'linkedin_manual', 'LinkedIn manual reminder', 30, true, false, '{"action":"manual_only"}'::jsonb
where not exists (select 1 from growth.channel_routing_rules where channel = 'linkedin_manual' and label = 'LinkedIn manual reminder');

insert into growth.channel_routing_rules (channel, label, priority, requires_approval, is_future_placeholder, match_criteria)
select 'sms_future', 'SMS future placeholder', 900, true, true, '{"blocked":true}'::jsonb
where not exists (select 1 from growth.channel_routing_rules where channel = 'sms_future' and label = 'SMS future placeholder');

insert into growth.channel_routing_rules (channel, label, priority, requires_approval, is_future_placeholder, match_criteria)
select 'voicemail_future', 'Voicemail future placeholder', 901, true, true, '{"blocked":true}'::jsonb
where not exists (select 1 from growth.channel_routing_rules where channel = 'voicemail_future' and label = 'Voicemail future placeholder');

insert into growth.channel_routing_rules (channel, label, priority, requires_approval, is_future_placeholder, match_criteria)
select 'booking_followup', 'Booking follow-up task', 40, true, false, '{"link":"booking_intelligence"}'::jsonb
where not exists (select 1 from growth.channel_routing_rules where channel = 'booking_followup' and label = 'Booking follow-up task');

-- -----------------------------------------------------------------------------
-- Extend platform timeline
-- -----------------------------------------------------------------------------

alter table growth.platform_timeline_events
  drop constraint if exists platform_timeline_events_event_type_check;

alter table growth.platform_timeline_events
  add constraint platform_timeline_events_event_type_check
  check (event_type in (
    'provider_connected', 'provider_validation_failed', 'provider_disabled', 'provider_reconnected',
    'sender_connected', 'sender_disabled', 'sender_score_changed',
    'domain_health_declined', 'domain_validated',
    'mailbox_connected', 'mailbox_disconnected', 'mailbox_validation_failed',
    'mailbox_token_expired', 'mailbox_health_declined',
    'spf_missing', 'dkim_missing', 'dmarc_missing', 'dns_health_declined', 'deliverability_improved',
    'domain_warning_created', 'warmup_started', 'warmup_paused', 'warmup_completed',
    'warmup_health_declined', 'warmup_progress_milestone',
    'sequence_created', 'sequence_started', 'sequence_paused', 'sequence_completed',
    'sequence_cancelled', 'sequence_health_declined',
    'reply_detected', 'positive_interest_detected', 'budget_objection_detected',
    'timeline_objection_detected', 'meeting_interest_detected', 'unsubscribe_detected',
    'thread_owner_assigned', 'thread_claimed', 'thread_handoff', 'thread_unassigned',
    'thread_sla_overdue', 'inbox_assignment_rule_applied',
    'delivery_route_changed', 'fallback_route_triggered',
    'delivery_queued', 'delivery_sent', 'delivery_failed', 'delivery_retry', 'rate_limit_hit',
    'inbox_sync_started', 'inbox_sync_completed', 'inbox_reply_imported',
    'inbox_thread_matched', 'inbox_thread_created', 'inbox_duplicate_skipped',
    'reply_draft_generated', 'reply_draft_approved', 'reply_draft_discarded',
    'reply_draft_sent', 'reply_draft_blocked',
    'experiment_created', 'experiment_started', 'experiment_paused', 'experiment_completed',
    'experiment_winner_recommended', 'experiment_winner_promoted', 'experiment_variant_assigned',
    'performance_snapshot_recorded', 'revenue_attribution_recorded',
    'performance_risk_detected', 'performance_trend_detected',
    'opportunity_signal_detected', 'opportunity_recommendation_created',
    'opportunity_recommendation_accepted', 'opportunity_recommendation_dismissed',
    'committee_signal_detected', 'sequence_pause_candidate_detected',
    'booking_intent_detected', 'booking_recommendation_created',
    'booking_recommendation_approved', 'booking_recommendation_dismissed',
    'booking_recommendation_completed', 'meeting_conversion_recorded',
    'sequence_meeting_exit_candidate_detected',
    'channel_task_planned', 'channel_task_approved', 'channel_task_completed',
    'channel_task_skipped', 'channel_task_blocked', 'channel_performance_recorded'
  ));

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.sequence_channel_tasks from public, anon, authenticated;
revoke all on table growth.sequence_channel_task_events from public, anon, authenticated;
revoke all on table growth.channel_performance_snapshots from public, anon, authenticated;
revoke all on table growth.channel_routing_rules from public, anon, authenticated;

grant select, insert, update, delete on table growth.sequence_channel_tasks to service_role;
grant select, insert, update, delete on table growth.sequence_channel_task_events to service_role;
grant select, insert, update, delete on table growth.channel_performance_snapshots to service_role;
grant select, insert, update, delete on table growth.channel_routing_rules to service_role;

alter table growth.sequence_channel_tasks enable row level security;
alter table growth.sequence_channel_task_events enable row level security;
alter table growth.channel_performance_snapshots enable row level security;
alter table growth.channel_routing_rules enable row level security;

alter table growth.sequence_channel_tasks force row level security;
alter table growth.sequence_channel_task_events force row level security;
alter table growth.channel_performance_snapshots force row level security;
alter table growth.channel_routing_rules force row level security;

create policy growth_sequence_channel_tasks_service_role
  on growth.sequence_channel_tasks for all to service_role using (true) with check (true);
create policy growth_sequence_channel_task_events_service_role
  on growth.sequence_channel_task_events for all to service_role using (true) with check (true);
create policy growth_channel_performance_snapshots_service_role
  on growth.channel_performance_snapshots for all to service_role using (true) with check (true);
create policy growth_channel_routing_rules_service_role
  on growth.channel_routing_rules for all to service_role using (true) with check (true);
