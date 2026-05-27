-- Growth Engine Phase 2N — Inbox CRM + opportunity intelligence.
-- Recommendations only — no autonomous CRM mutation, stage movement, or sequence pause.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
  if to_regclass('growth.inbox_threads') is null then
    raise exception 'Missing dependency: growth.inbox_threads';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.opportunity_signals
-- -----------------------------------------------------------------------------

create table if not exists growth.opportunity_signals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  inbox_thread_id uuid,
  signal_type text not null
    check (signal_type in (
      'meeting_interest', 'pricing_interest', 'timeline_interest',
      'decision_maker_detected', 'committee_detected', 'budget_signal',
      'technical_validation', 'proposal_request', 'competitive_signal', 'urgency_signal'
    )),
  confidence text not null default 'medium'
    check (confidence in ('low', 'medium', 'high', 'verified')),
  evidence_snippet text not null default '',
  source text not null default 'inbox_classifier',
  metadata jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_opportunity_signals_lead
  on growth.opportunity_signals (lead_id, detected_at desc);

create index if not exists idx_growth_opportunity_signals_type
  on growth.opportunity_signals (signal_type, detected_at desc);

comment on table growth.opportunity_signals is
  'Deterministic opportunity signals from inbox and engagement — evidence-backed, no autonomous CRM writes.';

-- -----------------------------------------------------------------------------
-- growth.opportunity_recommendations
-- -----------------------------------------------------------------------------

create table if not exists growth.opportunity_recommendations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  inbox_thread_id uuid,
  recommendation_type text not null
    check (recommendation_type in (
      'create_opportunity', 'advance_stage', 'pause_sequence', 'stop_sequence',
      'follow_up_needed', 'human_review_needed', 'assign_owner', 'committee_expansion'
    )),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'dismissed', 'expired')),
  title text not null default '',
  description text not null default '',
  evidence jsonb not null default '[]'::jsonb,
  signal_ids uuid[] not null default '{}'::uuid[],
  requires_human_approval boolean not null default true,
  accepted_by uuid,
  dismissed_by uuid,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_opportunity_recommendations_lead
  on growth.opportunity_recommendations (lead_id, status, created_at desc);

create index if not exists idx_growth_opportunity_recommendations_status
  on growth.opportunity_recommendations (status, created_at desc);

comment on table growth.opportunity_recommendations is
  'Human-gated CRM and workflow recommendations — acceptance records intent only, no autonomous mutation.';

-- -----------------------------------------------------------------------------
-- growth.buying_committee_signals
-- -----------------------------------------------------------------------------

create table if not exists growth.buying_committee_signals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  inbox_thread_id uuid,
  contact_label text not null default '',
  role_hint text,
  signal_strength text not null default 'medium'
    check (signal_strength in ('low', 'medium', 'high', 'verified')),
  evidence_snippet text not null default '',
  source text not null default 'inbox_classifier',
  metadata jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_buying_committee_signals_lead
  on growth.buying_committee_signals (lead_id, detected_at desc);

comment on table growth.buying_committee_signals is
  'Committee expansion signals from referral and multi-stakeholder language.';

-- -----------------------------------------------------------------------------
-- growth.crm_intelligence_events
-- -----------------------------------------------------------------------------

create table if not exists growth.crm_intelligence_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid,
  recommendation_id uuid references growth.opportunity_recommendations (id) on delete set null,
  signal_id uuid references growth.opportunity_signals (id) on delete set null,
  event_type text not null,
  severity text not null default 'info'
    check (severity in ('info', 'low', 'medium', 'high', 'critical')),
  title text not null default '',
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_crm_intelligence_events_lead
  on growth.crm_intelligence_events (lead_id, created_at desc);

comment on table growth.crm_intelligence_events is
  'Audit trail for opportunity intelligence — no provider payloads stored.';

-- -----------------------------------------------------------------------------
-- growth.sequence_pause_candidates
-- -----------------------------------------------------------------------------

create table if not exists growth.sequence_pause_candidates (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  sequence_enrollment_id uuid,
  recommendation_id uuid references growth.opportunity_recommendations (id) on delete set null,
  reason text not null default '',
  signal_type text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'dismissed', 'expired')),
  evidence_snippet text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_sequence_pause_candidates_lead
  on growth.sequence_pause_candidates (lead_id, status, detected_at desc);

comment on table growth.sequence_pause_candidates is
  'Sequence pause recommendations — human must pause; no autonomous enrollment changes.';

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
    'committee_signal_detected', 'sequence_pause_candidate_detected'
  ));

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.opportunity_signals from public, anon, authenticated;
revoke all on table growth.opportunity_recommendations from public, anon, authenticated;
revoke all on table growth.buying_committee_signals from public, anon, authenticated;
revoke all on table growth.crm_intelligence_events from public, anon, authenticated;
revoke all on table growth.sequence_pause_candidates from public, anon, authenticated;

grant select, insert, update, delete on table growth.opportunity_signals to service_role;
grant select, insert, update, delete on table growth.opportunity_recommendations to service_role;
grant select, insert, update, delete on table growth.buying_committee_signals to service_role;
grant select, insert, update, delete on table growth.crm_intelligence_events to service_role;
grant select, insert, update, delete on table growth.sequence_pause_candidates to service_role;

alter table growth.opportunity_signals enable row level security;
alter table growth.opportunity_recommendations enable row level security;
alter table growth.buying_committee_signals enable row level security;
alter table growth.crm_intelligence_events enable row level security;
alter table growth.sequence_pause_candidates enable row level security;

alter table growth.opportunity_signals force row level security;
alter table growth.opportunity_recommendations force row level security;
alter table growth.buying_committee_signals force row level security;
alter table growth.crm_intelligence_events force row level security;
alter table growth.sequence_pause_candidates force row level security;

create policy growth_opportunity_signals_service_role
  on growth.opportunity_signals for all to service_role using (true) with check (true);
create policy growth_opportunity_recommendations_service_role
  on growth.opportunity_recommendations for all to service_role using (true) with check (true);
create policy growth_buying_committee_signals_service_role
  on growth.buying_committee_signals for all to service_role using (true) with check (true);
create policy growth_crm_intelligence_events_service_role
  on growth.crm_intelligence_events for all to service_role using (true) with check (true);
create policy growth_sequence_pause_candidates_service_role
  on growth.sequence_pause_candidates for all to service_role using (true) with check (true);
