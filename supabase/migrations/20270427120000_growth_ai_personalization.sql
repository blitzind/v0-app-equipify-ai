-- Growth Engine Phase 2V — AI Prospect Personalization Layer.
-- Evidence-backed personalization with mandatory human review — no autonomous sends.

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
-- growth.personalization_profiles
-- -----------------------------------------------------------------------------

create table if not exists growth.personalization_profiles (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references growth.leads (id) on delete cascade,
  lead_label text not null default '',
  personalization_score numeric not null default 0 check (personalization_score >= 0 and personalization_score <= 100),
  evidence_coverage_score numeric not null default 0 check (evidence_coverage_score >= 0 and evidence_coverage_score <= 100),
  top_sources jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_personalization_profiles_lead
  on growth.personalization_profiles (lead_id, updated_at desc);

comment on table growth.personalization_profiles is
  'Per-lead personalization profile — evidence coverage and source visibility only.';

-- -----------------------------------------------------------------------------
-- growth.personalization_generations
-- -----------------------------------------------------------------------------

create table if not exists growth.personalization_generations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  profile_id uuid references growth.personalization_profiles (id) on delete set null,
  lead_label text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'rejected', 'sent', 'archived', 'blocked')),
  subject text not null default '',
  body text not null default '',
  personalization_score numeric not null default 0 check (personalization_score >= 0 and personalization_score <= 100),
  evidence_coverage_score numeric not null default 0 check (evidence_coverage_score >= 0 and evidence_coverage_score <= 100),
  risk_level text not null default 'low'
    check (risk_level in ('low', 'medium', 'high', 'critical')),
  blocked_reason text not null default '',
  source_summary jsonb not null default '[]'::jsonb,
  content_template_version_id uuid,
  snippet_ids uuid[] not null default '{}'::uuid[],
  sequence_execution_job_id uuid,
  requires_human_review boolean not null default true,
  approved_by uuid,
  approved_at timestamptz,
  rejected_by uuid,
  rejected_at timestamptz,
  sent_at timestamptz,
  created_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_personalization_generations_lead
  on growth.personalization_generations (lead_id, created_at desc);

create index if not exists idx_growth_personalization_generations_status
  on growth.personalization_generations (status, risk_level, created_at desc);

comment on table growth.personalization_generations is
  'AI personalization generations — human approval required, blocked generations cannot be approved or sent.';

-- -----------------------------------------------------------------------------
-- growth.personalization_evidence
-- -----------------------------------------------------------------------------

create table if not exists growth.personalization_evidence (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references growth.personalization_generations (id) on delete cascade,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  source_type text not null
    check (source_type in (
      'relationship_memory', 'opportunity_intelligence', 'booking_intelligence', 'market_graph',
      'territory_intelligence', 'website_intelligence', 'engagement_history', 'committee_context',
      'buying_signals', 'company_signals'
    )),
  claim_key text not null default '',
  evidence_snippet text not null default '',
  confidence text not null default 'medium'
    check (confidence in ('low', 'medium', 'high', 'verified')),
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_growth_personalization_evidence_generation
  on growth.personalization_evidence (generation_id, recorded_at desc);

comment on table growth.personalization_evidence is
  'Evidence snippets backing personalization claims — sanitized, no provider payloads.';

-- -----------------------------------------------------------------------------
-- growth.personalization_risk_events
-- -----------------------------------------------------------------------------

create table if not exists growth.personalization_risk_events (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references growth.personalization_generations (id) on delete cascade,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  risk_type text not null default 'unsupported_claim',
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high', 'critical')),
  title text not null default '',
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_growth_personalization_risk_events_generation
  on growth.personalization_risk_events (generation_id, severity, recorded_at desc);

comment on table growth.personalization_risk_events is
  'Personalization risk detections — hallucinated claims, unsupported metrics, compliance phrasing.';

-- -----------------------------------------------------------------------------
-- growth.personalization_feedback
-- -----------------------------------------------------------------------------

create table if not exists growth.personalization_feedback (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references growth.personalization_generations (id) on delete cascade,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  feedback_type text not null
    check (feedback_type in ('approved', 'edited', 'rejected', 'performed_well', 'performed_poorly')),
  notes text not null default '',
  actor_user_id uuid,
  actor_email text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_growth_personalization_feedback_generation
  on growth.personalization_feedback (generation_id, recorded_at desc);

comment on table growth.personalization_feedback is
  'Human feedback on personalization quality and performance.';

-- -----------------------------------------------------------------------------
-- growth.personalization_performance_snapshots
-- -----------------------------------------------------------------------------

create table if not exists growth.personalization_performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid references growth.personalization_generations (id) on delete set null,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  source_type text not null default 'relationship_memory',
  attribution_score numeric not null default 0 check (attribution_score >= 0 and attribution_score <= 100),
  reply_rate numeric,
  meeting_rate numeric,
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_growth_personalization_performance_snapshots_recorded
  on growth.personalization_performance_snapshots (recorded_at desc);

comment on table growth.personalization_performance_snapshots is
  'Attribution snapshots for personalization performance reporting.';

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
    'governance_retention_updated', 'governance_legal_hold_applied',
    'personalization_generated', 'personalization_approved', 'personalization_rejected',
    'personalization_blocked', 'personalization_sent', 'personalization_feedback_recorded'
  ));

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.personalization_profiles from public, anon, authenticated;
revoke all on table growth.personalization_generations from public, anon, authenticated;
revoke all on table growth.personalization_evidence from public, anon, authenticated;
revoke all on table growth.personalization_risk_events from public, anon, authenticated;
revoke all on table growth.personalization_feedback from public, anon, authenticated;
revoke all on table growth.personalization_performance_snapshots from public, anon, authenticated;

grant select, insert, update, delete on table growth.personalization_profiles to service_role;
grant select, insert, update, delete on table growth.personalization_generations to service_role;
grant select, insert, update, delete on table growth.personalization_evidence to service_role;
grant select, insert, update, delete on table growth.personalization_risk_events to service_role;
grant select, insert, update, delete on table growth.personalization_feedback to service_role;
grant select, insert, update, delete on table growth.personalization_performance_snapshots to service_role;

alter table growth.personalization_profiles enable row level security;
alter table growth.personalization_generations enable row level security;
alter table growth.personalization_evidence enable row level security;
alter table growth.personalization_risk_events enable row level security;
alter table growth.personalization_feedback enable row level security;
alter table growth.personalization_performance_snapshots enable row level security;

alter table growth.personalization_profiles force row level security;
alter table growth.personalization_generations force row level security;
alter table growth.personalization_evidence force row level security;
alter table growth.personalization_risk_events force row level security;
alter table growth.personalization_feedback force row level security;
alter table growth.personalization_performance_snapshots force row level security;

create policy growth_personalization_profiles_service_role
  on growth.personalization_profiles for all to service_role using (true) with check (true);

create policy growth_personalization_generations_service_role
  on growth.personalization_generations for all to service_role using (true) with check (true);

create policy growth_personalization_evidence_service_role
  on growth.personalization_evidence for all to service_role using (true) with check (true);

create policy growth_personalization_risk_events_service_role
  on growth.personalization_risk_events for all to service_role using (true) with check (true);

create policy growth_personalization_feedback_service_role
  on growth.personalization_feedback for all to service_role using (true) with check (true);

create policy growth_personalization_performance_snapshots_service_role
  on growth.personalization_performance_snapshots for all to service_role using (true) with check (true);
