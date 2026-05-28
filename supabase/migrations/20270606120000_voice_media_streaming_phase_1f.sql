-- Voice Infrastructure Phase 1F — Realtime media streaming + transcript infrastructure.
-- Twilio Media Streams scaffold, participant-aware transcripts, deterministic timelines.

do $$
begin
  if to_regclass('voice.voice_calls') is null then
    raise exception 'Missing dependency: voice.voice_calls (apply Phase 1A first)';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_media_direction'
  ) then
    create type voice.voice_media_direction as enum ('inbound', 'outbound', 'duplex');
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_stream_status'
  ) then
    create type voice.voice_stream_status as enum (
      'connecting',
      'active',
      'reconnecting',
      'stopped',
      'failed'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_media_participant_type'
  ) then
    create type voice.voice_media_participant_type as enum (
      'operator',
      'customer',
      'supervisor',
      'pstn',
      'browser',
      'unknown'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_audio_track'
  ) then
    create type voice.voice_audio_track as enum ('inbound_track', 'outbound_track', 'mixed');
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_transcript_provider_kind'
  ) then
    create type voice.voice_transcript_provider_kind as enum (
      'deepgram',
      'assemblyai',
      'openai_realtime',
      'stub',
      'none'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_transcript_session_status'
  ) then
    create type voice.voice_transcript_session_status as enum (
      'starting',
      'active',
      'paused',
      'finalizing',
      'completed',
      'failed'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_speaker_type'
  ) then
    create type voice.voice_speaker_type as enum (
      'operator',
      'customer',
      'supervisor',
      'system',
      'unknown'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_media_timeline_event_type'
  ) then
    create type voice.voice_media_timeline_event_type as enum (
      'stream_start',
      'stream_stop',
      'participant_join',
      'participant_leave',
      'stream_reconnect',
      'transcript_segment_append',
      'media_interruption_mark'
    );
  end if;
end;
$$;

create table if not exists voice.voice_media_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  voice_call_id uuid not null references voice.voice_calls (id) on delete cascade,
  voice_conference_id uuid references voice.voice_conferences (id) on delete set null,
  voice_recording_id uuid references voice.voice_recordings (id) on delete set null,
  provider voice.voice_provider_kind not null,
  provider_stream_sid text not null default '',
  media_direction voice.voice_media_direction not null default 'duplex',
  stream_status voice.voice_stream_status not null default 'connecting',
  started_at timestamptz,
  ended_at timestamptz,
  reconnect_count int not null default 0 check (reconnect_count >= 0),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_voice_media_sessions_active_provider_stream
  on voice.voice_media_sessions (organization_id, provider, provider_stream_sid)
  where stream_status in ('connecting', 'active', 'reconnecting')
    and provider_stream_sid <> '';

create index if not exists idx_voice_media_sessions_org_call
  on voice.voice_media_sessions (organization_id, voice_call_id, created_at desc);

comment on table voice.voice_media_sessions is
  'Realtime media stream sessions (Twilio Media Streams scaffold, provider-agnostic).';

create table if not exists voice.voice_media_participants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  media_session_id uuid not null references voice.voice_media_sessions (id) on delete cascade,
  voice_call_leg_id uuid references voice.voice_call_legs (id) on delete set null,
  participant_type voice.voice_media_participant_type not null default 'unknown',
  audio_track voice.voice_audio_track not null default 'mixed',
  stream_identity text not null default '',
  is_active boolean not null default true,
  joined_at timestamptz,
  left_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_voice_media_participants_session
  on voice.voice_media_participants (media_session_id, is_active, joined_at asc);

comment on table voice.voice_media_participants is
  'Participant ownership for media stream tracks (append-friendly join/leave history).';

create table if not exists voice.voice_transcript_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  media_session_id uuid not null references voice.voice_media_sessions (id) on delete cascade,
  voice_recording_id uuid references voice.voice_recordings (id) on delete set null,
  transcript_provider voice.voice_transcript_provider_kind not null default 'stub',
  transcript_status voice.voice_transcript_session_status not null default 'starting',
  started_at timestamptz,
  ended_at timestamptz,
  avg_latency_ms int check (avg_latency_ms is null or avg_latency_ms >= 0),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_voice_transcript_sessions_media
  on voice.voice_transcript_sessions (media_session_id, transcript_status, created_at desc);

comment on table voice.voice_transcript_sessions is
  'Transcript pipeline sessions correlated to media streams (no AI orchestration in Phase 1F).';

create table if not exists voice.voice_transcript_segments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  transcript_session_id uuid not null references voice.voice_transcript_sessions (id) on delete cascade,
  voice_call_leg_id uuid references voice.voice_call_legs (id) on delete set null,
  speaker_identity text not null default '',
  speaker_type voice.voice_speaker_type not null default 'unknown',
  transcript_text text not null default '',
  confidence_score numeric(5, 4) check (
    confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)
  ),
  started_at timestamptz,
  ended_at timestamptz,
  sequence_number int not null check (sequence_number >= 0),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint voice_transcript_segments_session_seq_unique unique (transcript_session_id, sequence_number)
);

create index if not exists idx_voice_transcript_segments_timeline
  on voice.voice_transcript_segments (transcript_session_id, sequence_number asc);

comment on table voice.voice_transcript_segments is
  'Append-only transcript timeline segments for replay and future AI analysis.';

create table if not exists voice.voice_media_timeline_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  media_session_id uuid not null references voice.voice_media_sessions (id) on delete cascade,
  voice_call_id uuid not null references voice.voice_calls (id) on delete cascade,
  event_type voice.voice_media_timeline_event_type not null,
  event_timestamp timestamptz not null default now(),
  idempotency_key text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint voice_media_timeline_events_idempotency_unique unique (organization_id, idempotency_key)
);

create index if not exists idx_voice_media_timeline_events_session
  on voice.voice_media_timeline_events (media_session_id, event_timestamp asc);

comment on table voice.voice_media_timeline_events is
  'Append-only deterministic media/transcript synchronization timeline.';

alter table voice.voice_media_sessions enable row level security;
alter table voice.voice_media_participants enable row level security;
alter table voice.voice_transcript_sessions enable row level security;
alter table voice.voice_transcript_segments enable row level security;
alter table voice.voice_media_timeline_events enable row level security;

create policy voice_media_sessions_select on voice.voice_media_sessions
  for select to authenticated
  using (public.has_org_role (organization_id, array['owner', 'admin', 'manager', 'tech']));

create policy voice_media_participants_select on voice.voice_media_participants
  for select to authenticated
  using (public.has_org_role (organization_id, array['owner', 'admin', 'manager', 'tech']));

create policy voice_transcript_sessions_select on voice.voice_transcript_sessions
  for select to authenticated
  using (public.has_org_role (organization_id, array['owner', 'admin', 'manager', 'tech']));

create policy voice_transcript_segments_select on voice.voice_transcript_segments
  for select to authenticated
  using (public.has_org_role (organization_id, array['owner', 'admin', 'manager', 'tech']));

create policy voice_media_timeline_events_select on voice.voice_media_timeline_events
  for select to authenticated
  using (public.has_org_role (organization_id, array['owner', 'admin', 'manager', 'tech']));

grant select on voice.voice_media_sessions to authenticated;
grant select on voice.voice_media_participants to authenticated;
grant select on voice.voice_transcript_sessions to authenticated;
grant select on voice.voice_transcript_segments to authenticated;
grant select on voice.voice_media_timeline_events to authenticated;

grant all on voice.voice_media_sessions to service_role;
grant all on voice.voice_media_participants to service_role;
grant all on voice.voice_transcript_sessions to service_role;
grant all on voice.voice_transcript_segments to service_role;
grant all on voice.voice_media_timeline_events to service_role;
