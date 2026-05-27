-- Growth Engine Phase 2U — Enterprise Governance + Controls.
-- Policy enforcement, auditability, exports, retention — no autonomous send changes or compliance bypass.

do $$
begin
  if to_regclass('growth.platform_timeline_events') is null then
    raise exception 'Missing dependency: growth.platform_timeline_events';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.governance_policies
-- -----------------------------------------------------------------------------

create table if not exists growth.governance_policies (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  description text not null default '',
  category text not null default 'sending'
    check (category in (
      'sending', 'approval', 'role_access', 'provider', 'domain',
      'compliance', 'retention', 'export', 'sequence', 'ai_generation'
    )),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'archived')),
  version integer not null default 1 check (version >= 1),
  metadata jsonb not null default '{}'::jsonb,
  activated_at timestamptz,
  paused_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_governance_policies_status
  on growth.governance_policies (status, category, updated_at desc);

comment on table growth.governance_policies is
  'Enterprise governance policies — server-side enforcement only, no hidden mutation.';

-- -----------------------------------------------------------------------------
-- growth.governance_policy_rules
-- -----------------------------------------------------------------------------

create table if not exists growth.governance_policy_rules (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references growth.governance_policies (id) on delete cascade,
  rule_type text not null
    check (rule_type in (
      'max_daily_sends', 'allowed_send_windows', 'approval_required_above_volume',
      'restricted_domains', 'restricted_providers', 'blocked_recipient_domains',
      'role_can_send', 'role_can_approve', 'role_can_export',
      'ai_requires_review', 'retention_days', 'legal_hold'
    )),
  rule_config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  priority integer not null default 100 check (priority >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_governance_policy_rules_policy
  on growth.governance_policy_rules (policy_id, enabled, priority);

comment on table growth.governance_policy_rules is
  'Policy rule definitions — evaluated server-side before send, approve, and export actions.';

-- -----------------------------------------------------------------------------
-- growth.governance_approval_audit (append-only)
-- -----------------------------------------------------------------------------

create table if not exists growth.governance_approval_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_email text not null default '',
  action text not null default '',
  entity_type text not null default '',
  entity_id uuid,
  source_route text not null default '',
  approval_reason text not null default '',
  policy_snapshot jsonb not null default '{}'::jsonb,
  risk_flags jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_growth_governance_approval_audit_recorded
  on growth.governance_approval_audit (recorded_at desc);

create index if not exists idx_growth_governance_approval_audit_actor
  on growth.governance_approval_audit (actor_email, recorded_at desc);

comment on table growth.governance_approval_audit is
  'Immutable approval audit trail — who, what, when, policy snapshot, risk flags.';

-- -----------------------------------------------------------------------------
-- growth.governance_activity_exports
-- -----------------------------------------------------------------------------

create table if not exists growth.governance_activity_exports (
  id uuid primary key default gen_random_uuid(),
  export_type text not null default 'activity_export'
    check (export_type in (
      'activity_export', 'approval_audit_export', 'delivery_audit_export'
    )),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  requested_by uuid,
  requested_by_email text not null default '',
  file_label text not null default '',
  row_count integer not null default 0 check (row_count >= 0),
  sanitized_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_governance_activity_exports_created
  on growth.governance_activity_exports (created_at desc);

comment on table growth.governance_activity_exports is
  'Sanitized activity exports — no raw secrets or provider payloads.';

-- -----------------------------------------------------------------------------
-- growth.governance_compliance_exports
-- -----------------------------------------------------------------------------

create table if not exists growth.governance_compliance_exports (
  id uuid primary key default gen_random_uuid(),
  export_type text not null default 'compliance_export'
    check (export_type in ('compliance_export', 'suppression_export')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  requested_by uuid,
  requested_by_email text not null default '',
  file_label text not null default '',
  row_count integer not null default 0 check (row_count >= 0),
  sanitized_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_governance_compliance_exports_created
  on growth.governance_compliance_exports (created_at desc);

comment on table growth.governance_compliance_exports is
  'Sanitized compliance exports — hashed recipients, no raw secrets.';

-- -----------------------------------------------------------------------------
-- growth.governance_retention_policies
-- -----------------------------------------------------------------------------

create table if not exists growth.governance_retention_policies (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'platform'
    check (scope in ('platform', 'audit', 'export', 'delivery', 'activity')),
  retention_days integer not null default 365 check (retention_days >= 0),
  legal_hold boolean not null default false,
  status text not null default 'active'
    check (status in ('draft', 'active', 'paused', 'archived')),
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_governance_retention_policies_scope
  on growth.governance_retention_policies (scope, status);

comment on table growth.governance_retention_policies is
  'Retention controls — legal hold prevents deletion/redaction where applicable. No deletion worker in this phase.';

-- -----------------------------------------------------------------------------
-- growth.governance_policy_events (immutable)
-- -----------------------------------------------------------------------------

create table if not exists growth.governance_policy_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null default 'policy_evaluated'
    check (event_type in (
      'policy_created', 'policy_activated', 'policy_paused', 'policy_archived',
      'policy_evaluated', 'policy_violation', 'approval_audited',
      'export_requested', 'export_completed', 'retention_updated', 'legal_hold_applied'
    )),
  policy_id uuid references growth.governance_policies (id) on delete set null,
  severity text not null default 'info'
    check (severity in ('info', 'low', 'medium', 'high', 'critical')),
  title text not null default '',
  description text not null default '',
  actor_user_id uuid,
  actor_email text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_growth_governance_policy_events_recorded
  on growth.governance_policy_events (recorded_at desc);

create index if not exists idx_growth_governance_policy_events_type
  on growth.governance_policy_events (event_type, recorded_at desc);

comment on table growth.governance_policy_events is
  'Immutable governance event log — auditability without hidden policy mutation.';

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
    'objection_memory_recorded', 'preference_memory_recorded', 'committee_context_recorded',
    'governance_policy_created', 'governance_policy_activated', 'governance_policy_paused',
    'governance_policy_violation', 'governance_approval_audited',
    'governance_export_requested', 'governance_export_completed',
    'governance_retention_updated', 'governance_legal_hold_applied'
  ));

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.governance_policies from public, anon, authenticated;
revoke all on table growth.governance_policy_rules from public, anon, authenticated;
revoke all on table growth.governance_approval_audit from public, anon, authenticated;
revoke all on table growth.governance_activity_exports from public, anon, authenticated;
revoke all on table growth.governance_compliance_exports from public, anon, authenticated;
revoke all on table growth.governance_retention_policies from public, anon, authenticated;
revoke all on table growth.governance_policy_events from public, anon, authenticated;

grant select, insert, update, delete on table growth.governance_policies to service_role;
grant select, insert, update, delete on table growth.governance_policy_rules to service_role;
grant select, insert on table growth.governance_approval_audit to service_role;
grant select, insert, update on table growth.governance_activity_exports to service_role;
grant select, insert, update on table growth.governance_compliance_exports to service_role;
grant select, insert, update, delete on table growth.governance_retention_policies to service_role;
grant select, insert on table growth.governance_policy_events to service_role;

alter table growth.governance_policies enable row level security;
alter table growth.governance_policy_rules enable row level security;
alter table growth.governance_approval_audit enable row level security;
alter table growth.governance_activity_exports enable row level security;
alter table growth.governance_compliance_exports enable row level security;
alter table growth.governance_retention_policies enable row level security;
alter table growth.governance_policy_events enable row level security;

alter table growth.governance_policies force row level security;
alter table growth.governance_policy_rules force row level security;
alter table growth.governance_approval_audit force row level security;
alter table growth.governance_activity_exports force row level security;
alter table growth.governance_compliance_exports force row level security;
alter table growth.governance_retention_policies force row level security;
alter table growth.governance_policy_events force row level security;

create policy growth_governance_policies_service_role
  on growth.governance_policies for all to service_role using (true) with check (true);

create policy growth_governance_policy_rules_service_role
  on growth.governance_policy_rules for all to service_role using (true) with check (true);

create policy growth_governance_approval_audit_service_role
  on growth.governance_approval_audit for insert to service_role with check (true);

create policy growth_governance_approval_audit_service_role_select
  on growth.governance_approval_audit for select to service_role using (true);

create policy growth_governance_activity_exports_service_role
  on growth.governance_activity_exports for all to service_role using (true) with check (true);

create policy growth_governance_compliance_exports_service_role
  on growth.governance_compliance_exports for all to service_role using (true) with check (true);

create policy growth_governance_retention_policies_service_role
  on growth.governance_retention_policies for all to service_role using (true) with check (true);

create policy growth_governance_policy_events_service_role
  on growth.governance_policy_events for insert to service_role with check (true);

create policy growth_governance_policy_events_service_role_select
  on growth.governance_policy_events for select to service_role using (true);
