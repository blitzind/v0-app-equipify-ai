-- Growth Engine Phase 2T — Lead Intelligence Memory + Relationship Context Engine.
-- Persistent relationship memory with evidence — no autonomous CRM mutation or hidden inference.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
  if to_regclass('growth.platform_timeline_events') is null then
    raise exception 'Missing dependency: growth.platform_timeline_events';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.lead_memory_profiles
-- -----------------------------------------------------------------------------

create table if not exists growth.lead_memory_profiles (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references growth.leads (id) on delete cascade,
  lead_label text not null default '',
  relationship_stage text not null default 'unknown'
    check (relationship_stage in ('unknown', 'aware', 'engaged', 'evaluating', 'opportunity', 'customer', 'inactive')),
  memory_coverage_score numeric not null default 0 check (memory_coverage_score >= 0 and memory_coverage_score <= 100),
  event_count integer not null default 0 check (event_count >= 0),
  objection_count integer not null default 0 check (objection_count >= 0),
  preference_count integer not null default 0 check (preference_count >= 0),
  committee_member_count integer not null default 0 check (committee_member_count >= 0),
  buying_signal_count integer not null default 0 check (buying_signal_count >= 0),
  highest_confidence text not null default 'low'
    check (highest_confidence in ('low', 'medium', 'high', 'verified')),
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  last_rebuilt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_lead_memory_profiles_stage
  on growth.lead_memory_profiles (relationship_stage, updated_at desc);

comment on table growth.lead_memory_profiles is
  'Per-lead relationship memory profile — evidence-backed, no provider payloads or secrets.';

-- -----------------------------------------------------------------------------
-- growth.lead_memory_events
-- -----------------------------------------------------------------------------

create table if not exists growth.lead_memory_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  lead_label text not null default '',
  memory_category text not null
    check (memory_category in (
      'communication_preference', 'buying_signal', 'objection', 'timeline_signal', 'budget_signal',
      'meeting_signal', 'engagement_pattern', 'industry_interest', 'committee_member',
      'decision_authority', 'risk_signal', 'competitor_signal'
    )),
  confidence text not null default 'medium'
    check (confidence in ('low', 'medium', 'high', 'verified')),
  title text not null default '',
  evidence_snippet text not null default '',
  source_system text not null default '',
  source_event_id uuid,
  inbox_thread_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_lead_memory_events_lead
  on growth.lead_memory_events (lead_id, recorded_at desc);

create index if not exists idx_growth_lead_memory_events_category
  on growth.lead_memory_events (memory_category, confidence, recorded_at desc);

comment on table growth.lead_memory_events is
  'Append-only lead memory events — sanitized evidence snippets only.';

-- -----------------------------------------------------------------------------
-- growth.lead_objection_memory
-- -----------------------------------------------------------------------------

create table if not exists growth.lead_objection_memory (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  lead_label text not null default '',
  objection_type text not null default 'general',
  objection_label text not null default '',
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high', 'critical')),
  confidence text not null default 'medium'
    check (confidence in ('low', 'medium', 'high', 'verified')),
  evidence_snippet text not null default '',
  source_system text not null default '',
  resolved boolean not null default false,
  resolved_at timestamptz,
  occurrence_count integer not null default 1 check (occurrence_count >= 1),
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_lead_objection_memory_lead
  on growth.lead_objection_memory (lead_id, resolved, last_seen_at desc);

comment on table growth.lead_objection_memory is
  'Objection memory per lead — human-gated, evidence required.';

-- -----------------------------------------------------------------------------
-- growth.lead_preference_memory
-- -----------------------------------------------------------------------------

create table if not exists growth.lead_preference_memory (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  lead_label text not null default '',
  preference_type text not null
    check (preference_type in ('communication_preference', 'buying_preference', 'timing_preference', 'channel_preference')),
  preference_key text not null default '',
  preference_value text not null default '',
  confidence text not null default 'medium'
    check (confidence in ('low', 'medium', 'high', 'verified')),
  evidence_snippet text not null default '',
  source_system text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_lead_preference_memory_lead
  on growth.lead_preference_memory (lead_id, preference_type, updated_at desc);

comment on table growth.lead_preference_memory is
  'Communication and buying preference memory — sanitized evidence only.';

-- -----------------------------------------------------------------------------
-- growth.relationship_context
-- -----------------------------------------------------------------------------

create table if not exists growth.relationship_context (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references growth.leads (id) on delete cascade,
  lead_label text not null default '',
  account_label text not null default '',
  relationship_stage text not null default 'unknown'
    check (relationship_stage in ('unknown', 'aware', 'engaged', 'evaluating', 'opportunity', 'customer', 'inactive')),
  progression_score numeric not null default 0 check (progression_score >= 0 and progression_score <= 100),
  engagement_trend text not null default 'stable'
    check (engagement_trend in ('improving', 'stable', 'cooling', 'declining')),
  top_signals jsonb not null default '[]'::jsonb,
  risk_flags jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_relationship_context_stage
  on growth.relationship_context (relationship_stage, updated_at desc);

comment on table growth.relationship_context is
  'Account relationship intelligence context — no cross-tenant leakage.';

-- -----------------------------------------------------------------------------
-- growth.committee_relationship_context
-- -----------------------------------------------------------------------------

create table if not exists growth.committee_relationship_context (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  lead_label text not null default '',
  member_label text not null default '',
  role_hint text not null default '',
  influence_level text not null default 'unknown'
    check (influence_level in ('unknown', 'low', 'medium', 'high', 'decision_maker')),
  confidence text not null default 'medium'
    check (confidence in ('low', 'medium', 'high', 'verified')),
  evidence_snippet text not null default '',
  source_system text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_committee_relationship_context_lead
  on growth.committee_relationship_context (lead_id, influence_level, created_at desc);

comment on table growth.committee_relationship_context is
  'Buying committee relationship context — masked labels, evidence required.';

-- -----------------------------------------------------------------------------
-- growth.relationship_summary_snapshots
-- -----------------------------------------------------------------------------

create table if not exists growth.relationship_summary_snapshots (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  lead_label text not null default '',
  relationship_stage text not null default 'unknown'
    check (relationship_stage in ('unknown', 'aware', 'engaged', 'evaluating', 'opportunity', 'customer', 'inactive')),
  summary text not null default '',
  memory_coverage_score numeric not null default 0,
  objection_highlights jsonb not null default '[]'::jsonb,
  preference_highlights jsonb not null default '[]'::jsonb,
  committee_highlights jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_relationship_summary_snapshots_lead
  on growth.relationship_summary_snapshots (lead_id, recorded_at desc);

comment on table growth.relationship_summary_snapshots is
  'Periodic relationship summary snapshots for dashboards and call workspace.';

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
    'sender_pool_created', 'sender_pool_rotated', 'sender_fatigue_detected', 'sender_pool_member_cooldown',
    'deliverability_ops_snapshot_recorded', 'deliverability_risk_detected',
    'deliverability_recommendation_created', 'deliverability_recommendation_acknowledged',
    'deliverability_recommendation_completed', 'deliverability_recommendation_dismissed',
    'deliverability_remediation_task_created',
    'content_template_created', 'content_template_submitted', 'content_template_approved',
    'content_template_rejected', 'content_snippet_approved', 'content_render_previewed',
    'lead_memory_recorded', 'lead_memory_rebuilt', 'relationship_stage_changed',
    'objection_memory_recorded', 'preference_memory_recorded', 'committee_context_recorded'
  ));

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.lead_memory_profiles from public, anon, authenticated;
revoke all on table growth.lead_memory_events from public, anon, authenticated;
revoke all on table growth.lead_objection_memory from public, anon, authenticated;
revoke all on table growth.lead_preference_memory from public, anon, authenticated;
revoke all on table growth.relationship_context from public, anon, authenticated;
revoke all on table growth.committee_relationship_context from public, anon, authenticated;
revoke all on table growth.relationship_summary_snapshots from public, anon, authenticated;

grant select, insert, update, delete on table growth.lead_memory_profiles to service_role;
grant select, insert, update, delete on table growth.lead_memory_events to service_role;
grant select, insert, update, delete on table growth.lead_objection_memory to service_role;
grant select, insert, update, delete on table growth.lead_preference_memory to service_role;
grant select, insert, update, delete on table growth.relationship_context to service_role;
grant select, insert, update, delete on table growth.committee_relationship_context to service_role;
grant select, insert, update, delete on table growth.relationship_summary_snapshots to service_role;

alter table growth.lead_memory_profiles enable row level security;
alter table growth.lead_memory_events enable row level security;
alter table growth.lead_objection_memory enable row level security;
alter table growth.lead_preference_memory enable row level security;
alter table growth.relationship_context enable row level security;
alter table growth.committee_relationship_context enable row level security;
alter table growth.relationship_summary_snapshots enable row level security;

alter table growth.lead_memory_profiles force row level security;
alter table growth.lead_memory_events force row level security;
alter table growth.lead_objection_memory force row level security;
alter table growth.lead_preference_memory force row level security;
alter table growth.relationship_context force row level security;
alter table growth.committee_relationship_context force row level security;
alter table growth.relationship_summary_snapshots force row level security;

create policy growth_lead_memory_profiles_service_role
  on growth.lead_memory_profiles for all to service_role using (true) with check (true);

create policy growth_lead_memory_events_service_role
  on growth.lead_memory_events for all to service_role using (true) with check (true);

create policy growth_lead_objection_memory_service_role
  on growth.lead_objection_memory for all to service_role using (true) with check (true);

create policy growth_lead_preference_memory_service_role
  on growth.lead_preference_memory for all to service_role using (true) with check (true);

create policy growth_relationship_context_service_role
  on growth.relationship_context for all to service_role using (true) with check (true);

create policy growth_committee_relationship_context_service_role
  on growth.committee_relationship_context for all to service_role using (true) with check (true);

create policy growth_relationship_summary_snapshots_service_role
  on growth.relationship_summary_snapshots for all to service_role using (true) with check (true);
