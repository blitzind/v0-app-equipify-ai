-- Growth Engine Phase 2S — Template + Snippet System.
-- Governed content library — approval required before live send; no autonomous promotion.

do $$
begin
  if to_regclass('growth.platform_timeline_events') is null then
    raise exception 'Missing dependency: growth.platform_timeline_events';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.content_templates
-- -----------------------------------------------------------------------------

create table if not exists growth.content_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_type text not null
    check (template_type in (
      'sequence_email', 'reply_draft', 'booking_followup', 'manual_call_script',
      'linkedin_manual', 'sms_future', 'voicemail_future'
    )),
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'approved', 'archived', 'rejected')),
  description text not null default '',
  current_version_id uuid,
  approved_version_id uuid,
  compliance_footer_required boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_content_templates_status
  on growth.content_templates (status, template_type, updated_at desc);

create index if not exists idx_growth_content_templates_type
  on growth.content_templates (template_type, updated_at desc);

comment on table growth.content_templates is
  'Governed outbound content templates — approval required; no secrets or raw provider payloads.';

-- -----------------------------------------------------------------------------
-- growth.content_template_versions
-- -----------------------------------------------------------------------------

create table if not exists growth.content_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references growth.content_templates (id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'approved', 'archived', 'rejected')),
  subject text not null default '',
  body text not null default '',
  snippet_ids jsonb not null default '[]'::jsonb,
  merge_fields jsonb not null default '[]'::jsonb,
  compliance_footer_required boolean not null default true,
  is_immutable boolean not null default false,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, version_number)
);

create index if not exists idx_growth_content_template_versions_template
  on growth.content_template_versions (template_id, version_number desc);

create index if not exists idx_growth_content_template_versions_status
  on growth.content_template_versions (status, created_at desc);

comment on table growth.content_template_versions is
  'Immutable approved template versions — editing approved template creates new draft version.';

-- -----------------------------------------------------------------------------
-- growth.content_snippets
-- -----------------------------------------------------------------------------

create table if not exists growth.content_snippets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null
    check (category in (
      'intro', 'value_prop', 'case_study', 'objection', 'pricing', 'meeting_request',
      'breakup', 'compliance_footer', 'personalization', 'industry_specific'
    )),
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'approved', 'archived', 'rejected')),
  description text not null default '',
  current_version_id uuid,
  approved_version_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_content_snippets_category
  on growth.content_snippets (category, status, updated_at desc);

comment on table growth.content_snippets is
  'Reusable content snippets insertable into templates — governed merge fields only.';

-- -----------------------------------------------------------------------------
-- growth.content_snippet_versions
-- -----------------------------------------------------------------------------

create table if not exists growth.content_snippet_versions (
  id uuid primary key default gen_random_uuid(),
  snippet_id uuid not null references growth.content_snippets (id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'approved', 'archived', 'rejected')),
  content text not null default '',
  merge_fields jsonb not null default '[]'::jsonb,
  is_immutable boolean not null default false,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (snippet_id, version_number)
);

create index if not exists idx_growth_content_snippet_versions_snippet
  on growth.content_snippet_versions (snippet_id, version_number desc);

comment on table growth.content_snippet_versions is
  'Snippet version history — approved versions immutable.';

-- -----------------------------------------------------------------------------
-- growth.content_variable_registry
-- -----------------------------------------------------------------------------

create table if not exists growth.content_variable_registry (
  id uuid primary key default gen_random_uuid(),
  variable_key text not null unique,
  label text not null default '',
  description text not null default '',
  namespace text not null default 'custom'
    check (namespace in ('lead', 'sender', 'sequence', 'booking', 'compliance', 'custom')),
  allowed boolean not null default true,
  example_value text not null default '',
  fallback_token text not null default '[missing]',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_content_variable_registry_namespace
  on growth.content_variable_registry (namespace, allowed);

comment on table growth.content_variable_registry is
  'Allowlisted merge variables — blocked secrets, tokens, and internal IDs.';

-- -----------------------------------------------------------------------------
-- growth.content_approval_events
-- -----------------------------------------------------------------------------

create table if not exists growth.content_approval_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null
    check (entity_type in ('template', 'snippet', 'template_version', 'snippet_version')),
  entity_id uuid not null,
  event_type text not null
    check (event_type in ('submitted', 'approved', 'rejected', 'archived', 'draft_created')),
  actor_user_id uuid,
  title text not null default '',
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_content_approval_events_entity
  on growth.content_approval_events (entity_type, entity_id, created_at desc);

comment on table growth.content_approval_events is
  'Append-only content governance audit — human approval workflow.';

-- -----------------------------------------------------------------------------
-- FK back-references for current/approved version pointers
-- -----------------------------------------------------------------------------

alter table growth.content_templates
  add constraint content_templates_current_version_fk
  foreign key (current_version_id) references growth.content_template_versions (id) on delete set null;

alter table growth.content_templates
  add constraint content_templates_approved_version_fk
  foreign key (approved_version_id) references growth.content_template_versions (id) on delete set null;

alter table growth.content_snippets
  add constraint content_snippets_current_version_fk
  foreign key (current_version_id) references growth.content_snippet_versions (id) on delete set null;

alter table growth.content_snippets
  add constraint content_snippets_approved_version_fk
  foreign key (approved_version_id) references growth.content_snippet_versions (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Seed allowlisted variables
-- -----------------------------------------------------------------------------

insert into growth.content_variable_registry (variable_key, label, description, namespace, allowed, example_value, fallback_token)
values
  ('lead.company_name', 'Lead company', 'Prospect company name', 'lead', true, 'Acme Field Service', '[company]'),
  ('lead.contact_name', 'Lead contact', 'Prospect contact name', 'lead', true, 'Alex', '[contact]'),
  ('lead.industry', 'Lead industry', 'Prospect industry vertical', 'lead', true, 'HVAC', '[industry]'),
  ('sender.name', 'Sender name', 'Outbound sender display name', 'sender', true, 'Jamie', '[sender]'),
  ('sender.email', 'Sender email', 'Outbound sender email address', 'sender', true, 'jamie@example.com', '[sender email]'),
  ('sequence.name', 'Sequence name', 'Active sequence name', 'sequence', true, 'Outbound Q2', '[sequence]'),
  ('booking.link', 'Booking link', 'Calendar booking URL', 'booking', true, '[booking link]', '[booking link]'),
  ('unsubscribe.link', 'Unsubscribe link', 'Compliance unsubscribe URL', 'compliance', true, '[unsubscribe link]', '[unsubscribe link]'),
  ('custom.safe_text', 'Safe custom text', 'Operator-approved custom merge text', 'custom', true, 'Custom value', '[custom]')
on conflict (variable_key) do nothing;

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
    'content_template_rejected', 'content_snippet_approved', 'content_render_previewed'
  ));

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.content_templates from public, anon, authenticated;
revoke all on table growth.content_template_versions from public, anon, authenticated;
revoke all on table growth.content_snippets from public, anon, authenticated;
revoke all on table growth.content_snippet_versions from public, anon, authenticated;
revoke all on table growth.content_variable_registry from public, anon, authenticated;
revoke all on table growth.content_approval_events from public, anon, authenticated;

grant select, insert, update, delete on table growth.content_templates to service_role;
grant select, insert, update, delete on table growth.content_template_versions to service_role;
grant select, insert, update, delete on table growth.content_snippets to service_role;
grant select, insert, update, delete on table growth.content_snippet_versions to service_role;
grant select, insert, update, delete on table growth.content_variable_registry to service_role;
grant select, insert, update, delete on table growth.content_approval_events to service_role;

alter table growth.content_templates enable row level security;
alter table growth.content_template_versions enable row level security;
alter table growth.content_snippets enable row level security;
alter table growth.content_snippet_versions enable row level security;
alter table growth.content_variable_registry enable row level security;
alter table growth.content_approval_events enable row level security;

alter table growth.content_templates force row level security;
alter table growth.content_template_versions force row level security;
alter table growth.content_snippets force row level security;
alter table growth.content_snippet_versions force row level security;
alter table growth.content_variable_registry force row level security;
alter table growth.content_approval_events force row level security;

create policy growth_content_templates_service_role
  on growth.content_templates for all to service_role using (true) with check (true);

create policy growth_content_template_versions_service_role
  on growth.content_template_versions for all to service_role using (true) with check (true);

create policy growth_content_snippets_service_role
  on growth.content_snippets for all to service_role using (true) with check (true);

create policy growth_content_snippet_versions_service_role
  on growth.content_snippet_versions for all to service_role using (true) with check (true);

create policy growth_content_variable_registry_service_role
  on growth.content_variable_registry for all to service_role using (true) with check (true);

create policy growth_content_approval_events_service_role
  on growth.content_approval_events for all to service_role using (true) with check (true);
