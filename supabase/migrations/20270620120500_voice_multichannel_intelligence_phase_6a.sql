-- Phase 6A — Unified Multi-Channel Communications Intelligence.
-- Intelligence + visibility only — no autonomous omnichannel execution.

do $$
begin
  if to_regclass('voice.voice_workflow_orchestrations') is null then
    raise exception 'Missing dependency: voice.voice_workflow_orchestrations (apply Phase 5C first)';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_unified_communication_thread_type'
  ) then
    create type voice.voice_unified_communication_thread_type as enum (
      'support',
      'sales',
      'retention',
      'scheduling',
      'escalation',
      'onboarding',
      'followup',
      'unresolved_issue'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_unified_communication_thread_state'
  ) then
    create type voice.voice_unified_communication_thread_state as enum (
      'active',
      'awaiting_customer',
      'awaiting_operator',
      'escalated',
      'stalled',
      'resolved',
      'archived'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_unified_communication_channel'
  ) then
    create type voice.voice_unified_communication_channel as enum (
      'voice',
      'voicemail',
      'callback',
      'ai_receptionist',
      'outbound_ai',
      'scheduling',
      'sms',
      'email',
      'portal'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_unified_communication_event_type'
  ) then
    create type voice.voice_unified_communication_event_type as enum (
      'voice_call_completed',
      'voicemail_left',
      'ai_receptionist_interaction',
      'outbound_ai_completed',
      'callback_completed',
      'escalation_triggered',
      'operator_takeover',
      'followup_recommended',
      'communication_failed',
      'channel_transition',
      'unresolved_issue_detected',
      'scheduling_requested',
      'scheduling_completed',
      'opt_out_detected',
      'communication_resolved',
      'sms_event_recorded',
      'email_event_recorded',
      'portal_message_recorded'
    );
  end if;
end;
$$;

create table if not exists voice.voice_unified_communication_threads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  thread_type voice.voice_unified_communication_thread_type not null,
  relationship_memory_profile_id uuid,
  related_customer_id uuid,
  related_prospect_id uuid,
  related_opportunity_id uuid,
  primary_channel voice.voice_unified_communication_channel not null default 'voice',
  current_state voice.voice_unified_communication_thread_state not null default 'active',
  escalation_state text,
  last_channel_used voice.voice_unified_communication_channel,
  preferred_channel voice.voice_unified_communication_channel,
  communication_summary text not null default '',
  unresolved_issue_count integer not null default 0,
  last_interaction_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table voice.voice_unified_communication_threads is
  'Unified multi-channel communication threads — operator-controlled intelligence, no autonomous engagement.';

create index if not exists idx_voice_unified_comm_threads_org_state
  on voice.voice_unified_communication_threads (organization_id, current_state, updated_at desc);

create index if not exists idx_voice_unified_comm_threads_org_relationship
  on voice.voice_unified_communication_threads (organization_id, relationship_memory_profile_id, updated_at desc);

create table if not exists voice.voice_unified_communication_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  thread_id uuid not null references voice.voice_unified_communication_threads (id) on delete cascade,
  event_type voice.voice_unified_communication_event_type not null,
  channel voice.voice_unified_communication_channel not null,
  source_system text not null default '',
  evidence_text text not null default '',
  source_session_id uuid,
  source_call_id uuid,
  payload_json jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

comment on table voice.voice_unified_communication_events is
  'Append-only unified communication timeline — evidence-linked, replayable.';

create index if not exists idx_voice_unified_comm_events_thread_created
  on voice.voice_unified_communication_events (thread_id, created_at desc);

create index if not exists idx_voice_unified_comm_events_org_created
  on voice.voice_unified_communication_events (organization_id, created_at desc);

alter table voice.voice_unified_communication_threads enable row level security;
alter table voice.voice_unified_communication_events enable row level security;

drop policy if exists voice_unified_comm_threads_select on voice.voice_unified_communication_threads;
create policy voice_unified_comm_threads_select on voice.voice_unified_communication_threads
  for select to authenticated
  using (organization_id in (select om.organization_id from public.organization_members om where om.user_id = auth.uid()));

drop policy if exists voice_unified_comm_events_select on voice.voice_unified_communication_events;
create policy voice_unified_comm_events_select on voice.voice_unified_communication_events
  for select to authenticated
  using (organization_id in (select om.organization_id from public.organization_members om where om.user_id = auth.uid()));

grant select, insert, update on voice.voice_unified_communication_threads to service_role;
grant select, insert on voice.voice_unified_communication_events to service_role;
