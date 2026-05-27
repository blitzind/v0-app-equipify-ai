-- Growth Engine Phase 2L — Sequence A/B testing + experiment intelligence.
-- Growth owns experiment design, assignment, metrics, winner recommendations.
-- No autonomous winner promotion or sending.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
  if to_regclass('growth.delivery_attempts') is null then
    raise exception 'Missing dependency: growth.delivery_attempts';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.sequence_experiments
-- -----------------------------------------------------------------------------

create table if not exists growth.sequence_experiments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  experiment_type text not null
    check (experiment_type in (
      'subject', 'body', 'send_window', 'sender', 'provider_route', 'sequence_step', 'full_sequence'
    )),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'completed', 'archived')),
  sequence_id uuid,
  sequence_step_id uuid,
  control_variant_id uuid,
  winning_variant_id uuid,
  minimum_sample_size integer not null default 100 check (minimum_sample_size >= 10),
  confidence_threshold numeric(5,4) not null default 0.9500
    check (confidence_threshold >= 0.5000 and confidence_threshold <= 0.9999),
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  promoted_at timestamptz,
  created_by uuid,
  promoted_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_sequence_experiments_status
  on growth.sequence_experiments (status, created_at desc);

create index if not exists idx_growth_sequence_experiments_type
  on growth.sequence_experiments (experiment_type, status);

comment on table growth.sequence_experiments is
  'Controlled sequence A/B experiments — winner promotion requires explicit human action.';

-- -----------------------------------------------------------------------------
-- growth.sequence_experiment_variants
-- -----------------------------------------------------------------------------

create table if not exists growth.sequence_experiment_variants (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references growth.sequence_experiments (id) on delete cascade,
  label text not null,
  is_control boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  weight integer not null default 1 check (weight >= 1),
  status text not null default 'active'
    check (status in ('draft', 'active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_sequence_experiment_variants_experiment
  on growth.sequence_experiment_variants (experiment_id, is_control desc, created_at asc);

comment on table growth.sequence_experiment_variants is
  'Experiment arms with approved payload snapshots for send-time overlay.';

-- -----------------------------------------------------------------------------
-- growth.sequence_experiment_assignments
-- -----------------------------------------------------------------------------

create table if not exists growth.sequence_experiment_assignments (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references growth.sequence_experiments (id) on delete cascade,
  variant_id uuid not null references growth.sequence_experiment_variants (id) on delete cascade,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  sequence_enrollment_id uuid,
  assignment_hash text not null,
  delivery_attempt_id uuid references growth.delivery_attempts (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  assigned_at timestamptz not null default now(),
  unique (experiment_id, lead_id)
);

create index if not exists idx_growth_sequence_experiment_assignments_variant
  on growth.sequence_experiment_assignments (variant_id, assigned_at desc);

create index if not exists idx_growth_sequence_experiment_assignments_lead
  on growth.sequence_experiment_assignments (lead_id, assigned_at desc);

comment on table growth.sequence_experiment_assignments is
  'Deterministic lead-level experiment assignments (hash of lead_id + experiment_id).';

-- -----------------------------------------------------------------------------
-- growth.sequence_experiment_results
-- -----------------------------------------------------------------------------

create table if not exists growth.sequence_experiment_results (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references growth.sequence_experiments (id) on delete cascade,
  variant_id uuid not null references growth.sequence_experiment_variants (id) on delete cascade,
  metric text not null
    check (metric in (
      'sent', 'opens', 'clicks', 'replies', 'positive_replies',
      'meetings', 'bounces', 'unsubscribes', 'complaints'
    )),
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  unique (experiment_id, variant_id, metric)
);

create index if not exists idx_growth_sequence_experiment_results_experiment
  on growth.sequence_experiment_results (experiment_id, metric);

comment on table growth.sequence_experiment_results is
  'Aggregated experiment metrics per variant arm.';

-- -----------------------------------------------------------------------------
-- growth.sequence_experiment_events
-- -----------------------------------------------------------------------------

create table if not exists growth.sequence_experiment_events (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references growth.sequence_experiments (id) on delete cascade,
  variant_id uuid references growth.sequence_experiment_variants (id) on delete set null,
  event_type text not null,
  severity text not null default 'info'
    check (severity in ('info', 'low', 'medium', 'high', 'critical')),
  title text not null default '',
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_sequence_experiment_events_experiment
  on growth.sequence_experiment_events (experiment_id, created_at desc);

comment on table growth.sequence_experiment_events is
  'Audit trail for experiment lifecycle and winner recommendations.';

-- -----------------------------------------------------------------------------
-- FK backrefs for control/winning variant (deferred-safe)
-- -----------------------------------------------------------------------------

alter table growth.sequence_experiments
  drop constraint if exists sequence_experiments_control_variant_fk;

alter table growth.sequence_experiments
  add constraint sequence_experiments_control_variant_fk
  foreign key (control_variant_id) references growth.sequence_experiment_variants (id) on delete set null;

alter table growth.sequence_experiments
  drop constraint if exists sequence_experiments_winning_variant_fk;

alter table growth.sequence_experiments
  add constraint sequence_experiments_winning_variant_fk
  foreign key (winning_variant_id) references growth.sequence_experiment_variants (id) on delete set null;

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
    'experiment_winner_recommended', 'experiment_winner_promoted', 'experiment_variant_assigned'
  ));

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.sequence_experiments from public, anon, authenticated;
revoke all on table growth.sequence_experiment_variants from public, anon, authenticated;
revoke all on table growth.sequence_experiment_assignments from public, anon, authenticated;
revoke all on table growth.sequence_experiment_results from public, anon, authenticated;
revoke all on table growth.sequence_experiment_events from public, anon, authenticated;

grant select, insert, update, delete on table growth.sequence_experiments to service_role;
grant select, insert, update, delete on table growth.sequence_experiment_variants to service_role;
grant select, insert, update, delete on table growth.sequence_experiment_assignments to service_role;
grant select, insert, update, delete on table growth.sequence_experiment_results to service_role;
grant select, insert, update, delete on table growth.sequence_experiment_events to service_role;

alter table growth.sequence_experiments enable row level security;
alter table growth.sequence_experiment_variants enable row level security;
alter table growth.sequence_experiment_assignments enable row level security;
alter table growth.sequence_experiment_results enable row level security;
alter table growth.sequence_experiment_events enable row level security;

alter table growth.sequence_experiments force row level security;
alter table growth.sequence_experiment_variants force row level security;
alter table growth.sequence_experiment_assignments force row level security;
alter table growth.sequence_experiment_results force row level security;
alter table growth.sequence_experiment_events force row level security;

create policy growth_sequence_experiments_service_role
  on growth.sequence_experiments for all to service_role using (true) with check (true);
create policy growth_sequence_experiment_variants_service_role
  on growth.sequence_experiment_variants for all to service_role using (true) with check (true);
create policy growth_sequence_experiment_assignments_service_role
  on growth.sequence_experiment_assignments for all to service_role using (true) with check (true);
create policy growth_sequence_experiment_results_service_role
  on growth.sequence_experiment_results for all to service_role using (true) with check (true);
create policy growth_sequence_experiment_events_service_role
  on growth.sequence_experiment_events for all to service_role using (true) with check (true);
