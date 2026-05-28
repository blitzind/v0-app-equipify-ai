-- Phase 5A — Assisted AI Outbound Calling (bounded, supervised, approval-gated).
-- NOT autonomous cold-calling. Operator approval + compliance required.

do $$
begin
  if to_regclass('voice.voice_compliance_audit_events') is null then
    raise exception 'Missing dependency: voice.voice_compliance_audit_events (apply Phase 4C first)';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_ai_outbound_workflow_type'
  ) then
    create type voice.voice_ai_outbound_workflow_type as enum (
      'missed_call_callback',
      'voicemail_followup',
      'appointment_confirmation',
      'appointment_reminder',
      'qualification_callback',
      'after_hours_followup',
      'warm_reengagement',
      'operator_assisted_callback'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_ai_outbound_session_status'
  ) then
    create type voice.voice_ai_outbound_session_status as enum (
      'queued',
      'pending_operator_approval',
      'initiating',
      'active',
      'escalation_pending',
      'operator_joined',
      'voicemail_mode',
      'completed',
      'failed',
      'blocked_by_compliance',
      'canceled'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_ai_outbound_escalation_state'
  ) then
    create type voice.voice_ai_outbound_escalation_state as enum (
      'none',
      'pending',
      'operator_requested',
      'transfer_in_progress',
      'resolved'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_ai_outbound_supervision_mode'
  ) then
    create type voice.voice_ai_outbound_supervision_mode as enum (
      'approval_required',
      'operator_supervised',
      'operator_joined'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_ai_outbound_event_type'
  ) then
    create type voice.voice_ai_outbound_event_type as enum (
      'compliance_passed',
      'compliance_blocked',
      'operator_approved',
      'outbound_started',
      'voicemail_detected',
      'ai_response_generated',
      'escalation_triggered',
      'transfer_requested',
      'operator_joined',
      'scheduling_requested',
      'qualification_completed',
      'callback_requested',
      'opt_out_detected',
      'conversation_terminated',
      'outbound_failed',
      'session_queued',
      'session_canceled',
      'provider_fallback',
      'silence_handled',
      'interruption_detected'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_ai_outbound_provider'
  ) then
    create type voice.voice_ai_outbound_provider as enum (
      'deterministic',
      'deepgram',
      'openai_realtime',
      'elevenlabs',
      'stub'
    );
  end if;
end;
$$;

create table if not exists voice.voice_ai_outbound_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  related_customer_id uuid,
  related_prospect_id uuid,
  relationship_memory_profile_id uuid,
  source_recovery_event_id uuid references voice.voice_missed_call_recovery_events (id) on delete set null,
  source_campaign_id uuid,
  voice_call_id uuid references voice.voice_calls (id) on delete set null,
  phone_number text not null,
  outbound_session_status voice.voice_ai_outbound_session_status not null default 'pending_operator_approval',
  outbound_workflow_type voice.voice_ai_outbound_workflow_type not null,
  ai_provider voice.voice_ai_outbound_provider not null default 'deterministic',
  escalation_state voice.voice_ai_outbound_escalation_state not null default 'none',
  operator_supervision_mode voice.voice_ai_outbound_supervision_mode not null default 'approval_required',
  transcript_session_id uuid,
  compliance_decision text,
  compliance_reasons_json jsonb not null default '[]'::jsonb,
  manual_review_required boolean not null default false,
  message_preview text,
  approved_by uuid,
  approved_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table voice.voice_ai_outbound_sessions is
  'Bounded AI outbound sessions — approval-gated, compliance-checked, operator-supervised. No autonomous cold calling.';

create index if not exists idx_voice_ai_outbound_sessions_org_status
  on voice.voice_ai_outbound_sessions (organization_id, outbound_session_status, created_at desc);

create index if not exists idx_voice_ai_outbound_sessions_org_phone
  on voice.voice_ai_outbound_sessions (organization_id, phone_number);

create table if not exists voice.voice_ai_outbound_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  session_id uuid not null references voice.voice_ai_outbound_sessions (id) on delete cascade,
  voice_call_id uuid,
  event_type voice.voice_ai_outbound_event_type not null,
  evidence_text text not null default '',
  transcript_segment_id uuid,
  provider_source voice.voice_ai_outbound_provider,
  payload_json jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

comment on table voice.voice_ai_outbound_events is
  'Append-only AI outbound event timeline — evidence-linked, replayable.';

create index if not exists idx_voice_ai_outbound_events_session_created
  on voice.voice_ai_outbound_events (session_id, created_at desc);

alter table voice.voice_ai_outbound_sessions enable row level security;
alter table voice.voice_ai_outbound_events enable row level security;

create policy voice_ai_outbound_sessions_select on voice.voice_ai_outbound_sessions
  for select to authenticated
  using (organization_id in (select om.organization_id from public.organization_members om where om.user_id = auth.uid()));

create policy voice_ai_outbound_events_select on voice.voice_ai_outbound_events
  for select to authenticated
  using (organization_id in (select om.organization_id from public.organization_members om where om.user_id = auth.uid()));

grant select, insert, update, delete on voice.voice_ai_outbound_sessions to service_role;
grant select, insert on voice.voice_ai_outbound_events to service_role;
