-- Phase 4A — AI Inbound Receptionist (bounded, supervised, operator-overridable).
-- AI speaks to inbound callers only. No autonomous outbound, CRM mutation, or unrestricted chat.

do $$
begin
  if to_regclass('voice.voice_ai_copilot_suggestions') is null then
    raise exception 'Missing dependency: voice.voice_ai_copilot_suggestions (apply Phase 3A first)';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_ai_receptionist_status'
  ) then
    create type voice.voice_ai_receptionist_status as enum (
      'greeting',
      'qualification',
      'faq',
      'scheduling',
      'transfer_pending',
      'operator_joined',
      'voicemail_capture',
      'completed',
      'failed',
      'escalated'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_ai_receptionist_conversation_phase'
  ) then
    create type voice.voice_ai_receptionist_conversation_phase as enum (
      'greeting',
      'intent_detection',
      'qualification',
      'faq',
      'scheduling',
      'escalation',
      'transfer',
      'voicemail',
      'completed'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_ai_receptionist_event_type'
  ) then
    create type voice.voice_ai_receptionist_event_type as enum (
      'ai_response_generated',
      'caller_intent_detected',
      'qualification_answer',
      'faq_answered',
      'escalation_detected',
      'transfer_requested',
      'operator_joined',
      'interruption_detected',
      'fallback_triggered',
      'voicemail_requested',
      'scheduling_requested',
      'receptionist_failed',
      'missed_call_recovery_prepared',
      'operator_takeover',
      'session_started',
      'session_ended'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_ai_receptionist_provider'
  ) then
    create type voice.voice_ai_receptionist_provider as enum (
      'deterministic',
      'deepgram',
      'openai_realtime',
      'elevenlabs',
      'stub'
    );
  end if;
end;
$$;

create table if not exists voice.voice_ai_receptionist_faq_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  topic text not null,
  question_pattern text not null,
  approved_answer text not null,
  escalation_required boolean not null default false,
  blocked boolean not null default false,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table voice.voice_ai_receptionist_faq_entries is
  'Organization-approved FAQ answers for inbound AI receptionist. Unknown topics escalate.';

create index if not exists idx_voice_ai_receptionist_faq_org_sort
  on voice.voice_ai_receptionist_faq_entries (organization_id, sort_order, topic);

create table if not exists voice.voice_ai_receptionist_qualification_flows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  flow_key text not null,
  label text not null,
  steps_json jsonb not null default '[]'::jsonb,
  escalation_triggers_json jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, flow_key)
);

comment on table voice.voice_ai_receptionist_qualification_flows is
  'Bounded qualification step definitions — no unrestricted AI interrogation.';

create table if not exists voice.voice_ai_receptionist_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  voice_call_id uuid not null references voice.voice_calls (id) on delete cascade,
  voice_conference_id uuid references voice.voice_conferences (id) on delete set null,
  relationship_memory_profile_id uuid references voice.voice_relationship_memory_profiles (id) on delete set null,
  receptionist_status voice.voice_ai_receptionist_status not null default 'greeting',
  current_conversation_phase voice.voice_ai_receptionist_conversation_phase not null default 'greeting',
  escalation_risk_level text not null default 'low',
  active_operator_id uuid,
  ai_provider voice.voice_ai_receptionist_provider not null default 'deterministic',
  transcript_session_id uuid references voice.voice_transcript_sessions (id) on delete set null,
  media_session_id uuid references voice.voice_media_sessions (id) on delete set null,
  qualification_state_json jsonb not null default '{}'::jsonb,
  handoff_summary_draft text,
  latency_ms_last integer,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table voice.voice_ai_receptionist_sessions is
  'Bounded AI inbound receptionist sessions. Operator takeover and escalation-safe.';

create index if not exists idx_voice_ai_receptionist_sessions_org_call
  on voice.voice_ai_receptionist_sessions (organization_id, voice_call_id, created_at desc);

create index if not exists idx_voice_ai_receptionist_sessions_org_status
  on voice.voice_ai_receptionist_sessions (organization_id, receptionist_status, started_at desc);

create table if not exists voice.voice_ai_receptionist_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  session_id uuid not null references voice.voice_ai_receptionist_sessions (id) on delete cascade,
  voice_call_id uuid not null references voice.voice_calls (id) on delete cascade,
  event_type voice.voice_ai_receptionist_event_type not null,
  evidence_text text not null default '',
  transcript_segment_id uuid references voice.voice_transcript_segments (id) on delete set null,
  provider_source voice.voice_ai_receptionist_provider,
  payload_json jsonb not null default '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz not null default now()
);

comment on table voice.voice_ai_receptionist_events is
  'Append-only AI receptionist timeline — evidence-linked, replayable.';

create unique index if not exists idx_voice_ai_receptionist_events_idempotency
  on voice.voice_ai_receptionist_events (organization_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_voice_ai_receptionist_events_session_created
  on voice.voice_ai_receptionist_events (session_id, created_at desc);

alter table voice.voice_ai_receptionist_faq_entries enable row level security;
alter table voice.voice_ai_receptionist_qualification_flows enable row level security;
alter table voice.voice_ai_receptionist_sessions enable row level security;
alter table voice.voice_ai_receptionist_events enable row level security;

create policy voice_ai_receptionist_faq_select on voice.voice_ai_receptionist_faq_entries
  for select to authenticated
  using (organization_id in (select om.organization_id from public.organization_members om where om.user_id = auth.uid()));

create policy voice_ai_receptionist_flows_select on voice.voice_ai_receptionist_qualification_flows
  for select to authenticated
  using (organization_id in (select om.organization_id from public.organization_members om where om.user_id = auth.uid()));

create policy voice_ai_receptionist_sessions_select on voice.voice_ai_receptionist_sessions
  for select to authenticated
  using (organization_id in (select om.organization_id from public.organization_members om where om.user_id = auth.uid()));

create policy voice_ai_receptionist_events_select on voice.voice_ai_receptionist_events
  for select to authenticated
  using (organization_id in (select om.organization_id from public.organization_members om where om.user_id = auth.uid()));

grant select, insert, update, delete on voice.voice_ai_receptionist_faq_entries to service_role;
grant select, insert, update, delete on voice.voice_ai_receptionist_qualification_flows to service_role;
grant select, insert, update, delete on voice.voice_ai_receptionist_sessions to service_role;
grant select, insert, update, delete on voice.voice_ai_receptionist_events to service_role;
