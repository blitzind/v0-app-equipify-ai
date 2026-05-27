-- Growth Engine Phase 2Q — Sender Pool Intelligence + Rotation Engine.
-- Human-gated sends only — pools rotate eligible senders; no autonomous bypass of approvals.

do $$
begin
  if to_regclass('growth.sender_accounts') is null then
    raise exception 'Missing dependency: growth.sender_accounts';
  end if;
  if to_regclass('growth.delivery_providers') is null then
    raise exception 'Missing dependency: growth.delivery_providers';
  end if;
  if to_regclass('growth.delivery_routes') is null then
    raise exception 'Missing dependency: growth.delivery_routes';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.sender_pools
-- -----------------------------------------------------------------------------

create table if not exists growth.sender_pools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'disabled')),
  rotation_strategy text not null default 'weighted_health'
    check (rotation_strategy in (
      'round_robin', 'weighted_health', 'lowest_volume', 'best_reputation', 'warmup_safe', 'manual_priority'
    )),
  daily_pool_cap integer check (daily_pool_cap is null or daily_pool_cap >= 0),
  requires_mailbox boolean not null default true,
  min_compliance_score numeric not null default 60 check (min_compliance_score >= 0 and min_compliance_score <= 100),
  allow_auto_rotation boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_sender_pools_status
  on growth.sender_pools (status, updated_at desc);

comment on table growth.sender_pools is
  'Sender pool definitions — rotation and deliverability balancing; no secrets stored.';

-- -----------------------------------------------------------------------------
-- growth.sender_pool_members
-- -----------------------------------------------------------------------------

create table if not exists growth.sender_pool_members (
  id uuid primary key default gen_random_uuid(),
  sender_pool_id uuid not null references growth.sender_pools (id) on delete cascade,
  sender_account_id uuid not null references growth.sender_accounts (id) on delete cascade,
  member_status text not null default 'eligible'
    check (member_status in ('eligible', 'cooldown', 'paused', 'blocked', 'warming', 'degraded')),
  priority_weight integer not null default 100 check (priority_weight >= 0),
  manual_priority integer not null default 100 check (manual_priority >= 0),
  last_selected_at timestamptz,
  cooldown_until timestamptz,
  notes text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sender_pool_id, sender_account_id)
);

create index if not exists idx_growth_sender_pool_members_pool
  on growth.sender_pool_members (sender_pool_id, member_status, manual_priority desc);

create index if not exists idx_growth_sender_pool_members_sender
  on growth.sender_pool_members (sender_account_id);

comment on table growth.sender_pool_members is
  'Sender pool membership — eligibility managed by rotation engine and fatigue detection.';

-- -----------------------------------------------------------------------------
-- growth.sender_rotation_decisions
-- -----------------------------------------------------------------------------

create table if not exists growth.sender_rotation_decisions (
  id uuid primary key default gen_random_uuid(),
  sender_pool_id uuid not null references growth.sender_pools (id) on delete cascade,
  sequence_execution_job_id uuid references growth.sequence_execution_jobs (id) on delete set null,
  delivery_attempt_id uuid references growth.delivery_attempts (id) on delete set null,
  selected_sender_account_id uuid references growth.sender_accounts (id) on delete set null,
  selected_provider_id uuid references growth.delivery_providers (id) on delete set null,
  selected_route_id uuid references growth.delivery_routes (id) on delete set null,
  decision_reason text not null default 'health_score'
    check (decision_reason in (
      'daily_cap_remaining', 'health_score', 'reputation_score', 'warmup_status',
      'bounce_risk', 'complaint_risk', 'recent_volume', 'provider_health',
      'domain_health', 'manual_override'
    )),
  risk_level text not null default 'low'
    check (risk_level in ('low', 'medium', 'high', 'critical')),
  allow_auto_rotation boolean not null default true,
  fallback_candidates jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_sender_rotation_decisions_pool
  on growth.sender_rotation_decisions (sender_pool_id, created_at desc);

create index if not exists idx_growth_sender_rotation_decisions_job
  on growth.sender_rotation_decisions (sequence_execution_job_id, created_at desc);

comment on table growth.sender_rotation_decisions is
  'Append-only rotation audit — selected sender/route and fallback candidates; no credentials.';

-- -----------------------------------------------------------------------------
-- growth.sender_fatigue_events
-- -----------------------------------------------------------------------------

create table if not exists growth.sender_fatigue_events (
  id uuid primary key default gen_random_uuid(),
  sender_account_id uuid not null references growth.sender_accounts (id) on delete cascade,
  sender_pool_id uuid references growth.sender_pools (id) on delete set null,
  fatigue_type text not null
    check (fatigue_type in (
      'high_recent_volume', 'reply_collapse', 'bounce_spike', 'complaint_spike',
      'open_click_collapse', 'warmup_mismatch', 'provider_degradation'
    )),
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high', 'critical')),
  title text not null default '',
  description text not null default '',
  signals jsonb not null default '{}'::jsonb,
  resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_sender_fatigue_events_sender
  on growth.sender_fatigue_events (sender_account_id, resolved, created_at desc);

create index if not exists idx_growth_sender_fatigue_events_pool
  on growth.sender_fatigue_events (sender_pool_id, created_at desc);

comment on table growth.sender_fatigue_events is
  'Sender fatigue signals — drives cooldown/degraded member status; no autonomous sends.';

-- -----------------------------------------------------------------------------
-- growth.sender_pool_performance_snapshots
-- -----------------------------------------------------------------------------

create table if not exists growth.sender_pool_performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  sender_pool_id uuid not null references growth.sender_pools (id) on delete cascade,
  eligible_members integer not null default 0,
  cooldown_members integer not null default 0,
  fatigue_warnings integer not null default 0,
  average_reputation numeric not null default 0,
  rotation_health_score numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_sender_pool_performance_pool
  on growth.sender_pool_performance_snapshots (sender_pool_id, recorded_at desc);

comment on table growth.sender_pool_performance_snapshots is
  'Periodic sender pool performance snapshots for admin dashboards.';

-- -----------------------------------------------------------------------------
-- Sequence / enrollment pool references
-- -----------------------------------------------------------------------------

alter table growth.sequence_patterns
  add column if not exists sender_pool_id uuid references growth.sender_pools (id) on delete set null,
  add column if not exists allow_auto_rotation boolean not null default true;

alter table growth.sequence_enrollments
  add column if not exists sender_pool_id uuid references growth.sender_pools (id) on delete set null,
  add column if not exists allow_auto_rotation boolean not null default true,
  add column if not exists manual_sender_account_id uuid references growth.sender_accounts (id) on delete set null;

alter table growth.sequence_execution_jobs
  add column if not exists sender_pool_id uuid references growth.sender_pools (id) on delete set null,
  add column if not exists allow_auto_rotation boolean not null default true,
  add column if not exists manual_sender_account_id uuid references growth.sender_accounts (id) on delete set null,
  add column if not exists sender_rotation_decision_id uuid references growth.sender_rotation_decisions (id) on delete set null;

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
    'channel_task_skipped', 'channel_task_blocked', 'channel_performance_recorded',
    'sender_pool_created', 'sender_pool_rotated', 'sender_fatigue_detected', 'sender_pool_member_cooldown'
  ));

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.sender_pools from public, anon, authenticated;
revoke all on table growth.sender_pool_members from public, anon, authenticated;
revoke all on table growth.sender_rotation_decisions from public, anon, authenticated;
revoke all on table growth.sender_fatigue_events from public, anon, authenticated;
revoke all on table growth.sender_pool_performance_snapshots from public, anon, authenticated;

grant select, insert, update, delete on table growth.sender_pools to service_role;
grant select, insert, update, delete on table growth.sender_pool_members to service_role;
grant select, insert, update, delete on table growth.sender_rotation_decisions to service_role;
grant select, insert, update, delete on table growth.sender_fatigue_events to service_role;
grant select, insert, update, delete on table growth.sender_pool_performance_snapshots to service_role;

alter table growth.sender_pools enable row level security;
alter table growth.sender_pool_members enable row level security;
alter table growth.sender_rotation_decisions enable row level security;
alter table growth.sender_fatigue_events enable row level security;
alter table growth.sender_pool_performance_snapshots enable row level security;

alter table growth.sender_pools force row level security;
alter table growth.sender_pool_members force row level security;
alter table growth.sender_rotation_decisions force row level security;
alter table growth.sender_fatigue_events force row level security;
alter table growth.sender_pool_performance_snapshots force row level security;

create policy growth_sender_pools_service_role
  on growth.sender_pools for all to service_role using (true) with check (true);

create policy growth_sender_pool_members_service_role
  on growth.sender_pool_members for all to service_role using (true) with check (true);

create policy growth_sender_rotation_decisions_service_role
  on growth.sender_rotation_decisions for all to service_role using (true) with check (true);

create policy growth_sender_fatigue_events_service_role
  on growth.sender_fatigue_events for all to service_role using (true) with check (true);

create policy growth_sender_pool_performance_snapshots_service_role
  on growth.sender_pool_performance_snapshots for all to service_role using (true) with check (true);
