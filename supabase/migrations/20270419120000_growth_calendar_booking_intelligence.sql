-- Growth Engine Phase 2O — Calendar booking intelligence + meeting conversion layer.
-- Recommendations only — no autonomous booking, calendar writes, or sequence stop.

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
-- growth.booking_intent_signals
-- -----------------------------------------------------------------------------

create table if not exists growth.booking_intent_signals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  inbox_thread_id uuid,
  intent_type text not null
    check (intent_type in (
      'meeting_request', 'demo_request', 'pricing_call', 'technical_call',
      'follow_up_call', 'decision_maker_call', 'referral_intro'
    )),
  confidence text not null default 'medium'
    check (confidence in ('low', 'medium', 'high', 'verified')),
  evidence_snippet text not null default '',
  source text not null default 'inbox_classifier',
  metadata jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_booking_intent_signals_lead
  on growth.booking_intent_signals (lead_id, detected_at desc);

create index if not exists idx_growth_booking_intent_signals_type
  on growth.booking_intent_signals (intent_type, detected_at desc);

comment on table growth.booking_intent_signals is
  'Meeting booking intent from inbox and opportunity signals — evidence-backed, no autonomous booking.';

-- -----------------------------------------------------------------------------
-- growth.booking_recommendations
-- -----------------------------------------------------------------------------

create table if not exists growth.booking_recommendations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  inbox_thread_id uuid,
  intent_signal_id uuid references growth.booking_intent_signals (id) on delete set null,
  recommendation_type text not null default 'book_meeting',
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'dismissed', 'completed', 'expired')),
  title text not null default '',
  description text not null default '',
  evidence jsonb not null default '[]'::jsonb,
  routing_rule_type text
    check (routing_rule_type is null or routing_rule_type in (
      'owner', 'round_robin', 'territory', 'industry', 'account_priority', 'manual'
    )),
  suggested_owner_label text,
  availability_hint text,
  requires_human_approval boolean not null default true,
  approved_by uuid,
  dismissed_by uuid,
  completed_by uuid,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_booking_recommendations_lead
  on growth.booking_recommendations (lead_id, status, created_at desc);

create index if not exists idx_growth_booking_recommendations_status
  on growth.booking_recommendations (status, created_at desc);

comment on table growth.booking_recommendations is
  'Human-gated meeting booking recommendations — approval does not book automatically.';

-- -----------------------------------------------------------------------------
-- growth.calendar_routing_rules
-- -----------------------------------------------------------------------------

create table if not exists growth.calendar_routing_rules (
  id uuid primary key default gen_random_uuid(),
  rule_type text not null
    check (rule_type in (
      'owner', 'round_robin', 'territory', 'industry', 'account_priority', 'manual'
    )),
  label text not null default '',
  priority integer not null default 100,
  is_active boolean not null default true,
  match_criteria jsonb not null default '{}'::jsonb,
  target_owner_label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_calendar_routing_rules_active
  on growth.calendar_routing_rules (is_active, priority asc);

comment on table growth.calendar_routing_rules is
  'Calendar routing rule foundation — provider-agnostic, no calendar tokens stored.';

-- -----------------------------------------------------------------------------
-- growth.booking_attribution_events
-- -----------------------------------------------------------------------------

create table if not exists growth.booking_attribution_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  recommendation_id uuid references growth.booking_recommendations (id) on delete set null,
  intent_signal_id uuid references growth.booking_intent_signals (id) on delete set null,
  event_type text not null,
  attribution_source text not null default 'booking_intelligence',
  sequence_enrollment_id uuid,
  weighted_score numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_booking_attribution_events_lead
  on growth.booking_attribution_events (lead_id, occurred_at desc);

comment on table growth.booking_attribution_events is
  'Meeting conversion attribution — no raw provider payloads.';

-- -----------------------------------------------------------------------------
-- growth.meeting_conversion_events
-- -----------------------------------------------------------------------------

create table if not exists growth.meeting_conversion_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  recommendation_id uuid references growth.booking_recommendations (id) on delete set null,
  event_type text not null,
  severity text not null default 'info'
    check (severity in ('info', 'low', 'medium', 'high', 'critical')),
  title text not null default '',
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_meeting_conversion_events_lead
  on growth.meeting_conversion_events (lead_id, created_at desc);

comment on table growth.meeting_conversion_events is
  'Audit trail for booking intelligence workflow — no calendar writes.';

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
    'sequence_meeting_exit_candidate_detected'
  ));

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.booking_intent_signals from public, anon, authenticated;
revoke all on table growth.booking_recommendations from public, anon, authenticated;
revoke all on table growth.calendar_routing_rules from public, anon, authenticated;
revoke all on table growth.booking_attribution_events from public, anon, authenticated;
revoke all on table growth.meeting_conversion_events from public, anon, authenticated;

grant select, insert, update, delete on table growth.booking_intent_signals to service_role;
grant select, insert, update, delete on table growth.booking_recommendations to service_role;
grant select, insert, update, delete on table growth.calendar_routing_rules to service_role;
grant select, insert, update, delete on table growth.booking_attribution_events to service_role;
grant select, insert, update, delete on table growth.meeting_conversion_events to service_role;

alter table growth.booking_intent_signals enable row level security;
alter table growth.booking_recommendations enable row level security;
alter table growth.calendar_routing_rules enable row level security;
alter table growth.booking_attribution_events enable row level security;
alter table growth.meeting_conversion_events enable row level security;

alter table growth.booking_intent_signals force row level security;
alter table growth.booking_recommendations force row level security;
alter table growth.calendar_routing_rules force row level security;
alter table growth.booking_attribution_events force row level security;
alter table growth.meeting_conversion_events force row level security;

create policy growth_booking_intent_signals_service_role
  on growth.booking_intent_signals for all to service_role using (true) with check (true);
create policy growth_booking_recommendations_service_role
  on growth.booking_recommendations for all to service_role using (true) with check (true);
create policy growth_calendar_routing_rules_service_role
  on growth.calendar_routing_rules for all to service_role using (true) with check (true);
create policy growth_booking_attribution_events_service_role
  on growth.booking_attribution_events for all to service_role using (true) with check (true);
create policy growth_meeting_conversion_events_service_role
  on growth.meeting_conversion_events for all to service_role using (true) with check (true);

-- Default routing rules (foundation)
insert into growth.calendar_routing_rules (rule_type, label, priority, match_criteria, target_owner_label)
select 'owner', 'Route to lead owner', 10, '{"scope":"lead_owner"}'::jsonb, 'Lead owner'
where not exists (
  select 1 from growth.calendar_routing_rules where rule_type = 'owner' and label = 'Route to lead owner'
);

insert into growth.calendar_routing_rules (rule_type, label, priority, match_criteria, target_owner_label)
select 'owner', 'Route to thread owner', 20, '{"scope":"thread_owner"}'::jsonb, 'Thread owner'
where not exists (
  select 1 from growth.calendar_routing_rules where rule_type = 'owner' and label = 'Route to thread owner'
);

insert into growth.calendar_routing_rules (rule_type, label, priority, match_criteria, target_owner_label)
select 'manual', 'Manual assignment fallback', 999, '{"scope":"manual"}'::jsonb, 'Manual review'
where not exists (
  select 1 from growth.calendar_routing_rules where rule_type = 'manual' and label = 'Manual assignment fallback'
);
