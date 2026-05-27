-- Growth Engine Phase 2A — Sequence Execution Foundation (orchestration only, no sending).

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
-- growth.sequence_templates
-- -----------------------------------------------------------------------------

create table if not exists growth.sequence_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  description text,
  category text,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'archived')),
  approval_required boolean not null default true,
  exit_on_reply boolean not null default true,
  exit_on_meeting boolean not null default true,
  exit_on_positive_intent boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_growth_sequence_templates_status
  on growth.sequence_templates (status)
  where deleted_at is null;

create index if not exists idx_growth_sequence_templates_category
  on growth.sequence_templates (category)
  where deleted_at is null;

comment on table growth.sequence_templates is
  'Deterministic sequence templates for orchestration planning — no autonomous execution in Phase 2A.';

-- -----------------------------------------------------------------------------
-- growth.sequence_template_steps
-- -----------------------------------------------------------------------------

create table if not exists growth.sequence_template_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_template_id uuid not null references growth.sequence_templates (id) on delete cascade,
  step_number integer not null check (step_number > 0),
  channel text not null default 'email'
    check (channel in ('email', 'manual_call', 'manual_followup', 'linkedin', 'sms_future')),
  delay_days integer not null default 0 check (delay_days >= 0),
  generation_type text not null default 'manual'
    check (generation_type in ('intro', 'followup', 'breakup', 'executive', 'manual')),
  approval_required boolean not null default true,
  condition_rules jsonb not null default '{}'::jsonb,
  exit_rules jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sequence_template_id, step_number)
);

create index if not exists idx_growth_sequence_template_steps_template
  on growth.sequence_template_steps (sequence_template_id, step_number asc);

comment on table growth.sequence_template_steps is
  'Ordered steps for a sequence template with human approval and exit metadata.';

-- -----------------------------------------------------------------------------
-- growth.sequence_template_enrollments
-- Phase 2A orchestration enrollments (parallel to 6.7A pattern enrollments table).
-- -----------------------------------------------------------------------------

create table if not exists growth.sequence_template_enrollments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  sequence_template_id uuid not null references growth.sequence_templates (id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'completed', 'failed', 'cancelled')),
  current_step integer not null default 1 check (current_step >= 1),
  next_step_due_at timestamptz,
  completion_reason text,
  health_score integer not null default 100 check (health_score >= 0 and health_score <= 100),
  health_tier text not null default 'healthy'
    check (health_tier in ('healthy', 'warning', 'degraded', 'critical')),
  enrolled_by uuid,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_sequence_template_enrollments_lead
  on growth.sequence_template_enrollments (lead_id);

create index if not exists idx_growth_sequence_template_enrollments_status
  on growth.sequence_template_enrollments (status);

create index if not exists idx_growth_sequence_template_enrollments_due
  on growth.sequence_template_enrollments (next_step_due_at nulls last);

comment on table growth.sequence_template_enrollments is
  'Template-based sequence enrollments for orchestration state tracking — no outbound execution.';

-- -----------------------------------------------------------------------------
-- growth.sequence_execution_events
-- -----------------------------------------------------------------------------

create table if not exists growth.sequence_execution_events (
  id uuid primary key default gen_random_uuid(),
  sequence_enrollment_id uuid not null references growth.sequence_template_enrollments (id) on delete cascade,
  event_type text not null default 'health_check',
  severity text not null default 'low'
    check (severity in ('low', 'medium', 'high', 'critical')),
  title text not null default '',
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_sequence_execution_events_enrollment
  on growth.sequence_execution_events (sequence_enrollment_id, created_at desc);

create index if not exists idx_growth_sequence_execution_events_created
  on growth.sequence_execution_events (created_at desc);

comment on table growth.sequence_execution_events is
  'Sequence orchestration event feed for platform monitoring.';

-- -----------------------------------------------------------------------------
-- Extend platform timeline for sequence orchestration events
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
    'sequence_health_declined'
  ));

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.sequence_templates from public, anon, authenticated;
revoke all on table growth.sequence_template_steps from public, anon, authenticated;
revoke all on table growth.sequence_template_enrollments from public, anon, authenticated;
revoke all on table growth.sequence_execution_events from public, anon, authenticated;

grant select, insert, update, delete on table growth.sequence_templates to service_role;
grant select, insert, update, delete on table growth.sequence_template_steps to service_role;
grant select, insert, update, delete on table growth.sequence_template_enrollments to service_role;
grant select, insert, update, delete on table growth.sequence_execution_events to service_role;

alter table growth.sequence_templates enable row level security;
alter table growth.sequence_template_steps enable row level security;
alter table growth.sequence_template_enrollments enable row level security;
alter table growth.sequence_execution_events enable row level security;

alter table growth.sequence_templates force row level security;
alter table growth.sequence_template_steps force row level security;
alter table growth.sequence_template_enrollments force row level security;
alter table growth.sequence_execution_events force row level security;

create policy growth_sequence_templates_service_role
  on growth.sequence_templates for all to service_role using (true) with check (true);

create policy growth_sequence_template_steps_service_role
  on growth.sequence_template_steps for all to service_role using (true) with check (true);

create policy growth_sequence_template_enrollments_service_role
  on growth.sequence_template_enrollments for all to service_role using (true) with check (true);

create policy growth_sequence_execution_events_service_role
  on growth.sequence_execution_events for all to service_role using (true) with check (true);
