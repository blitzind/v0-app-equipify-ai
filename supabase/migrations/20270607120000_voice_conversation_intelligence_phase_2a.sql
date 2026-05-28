-- Voice Infrastructure Phase 2A — Passive conversation intelligence (transcript analysis only).
-- Evidence-backed operator insights. No autonomous AI actions.

do $$
begin
  if to_regclass('voice.voice_transcript_segments') is null then
    raise exception 'Missing dependency: voice.voice_transcript_segments (apply Phase 1F first)';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_intelligence_analysis_provider'
  ) then
    create type voice.voice_intelligence_analysis_provider as enum (
      'deterministic_rules',
      'openai',
      'stub'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_intelligence_event_status'
  ) then
    create type voice.voice_intelligence_event_status as enum (
      'detected',
      'operator_acknowledged',
      'dismissed'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_memory_draft_status'
  ) then
    create type voice.voice_memory_draft_status as enum (
      'pending_review',
      'accepted',
      'rejected'
    );
  end if;
end;
$$;

create table if not exists voice.voice_conversation_intelligence_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  voice_call_id uuid not null references voice.voice_calls (id) on delete cascade,
  transcript_session_id uuid not null references voice.voice_transcript_sessions (id) on delete cascade,
  transcript_segment_id uuid not null references voice.voice_transcript_segments (id) on delete cascade,
  event_type text not null,
  confidence_score numeric(5,4) not null check (confidence_score >= 0 and confidence_score <= 1),
  evidence_text text not null,
  suggested_operator_action text not null default '',
  analysis_provider voice.voice_intelligence_analysis_provider not null default 'deterministic_rules',
  status voice.voice_intelligence_event_status not null default 'detected',
  metadata_json jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (transcript_segment_id, event_type)
);

create table if not exists voice.voice_objection_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  voice_call_id uuid not null references voice.voice_calls (id) on delete cascade,
  transcript_session_id uuid not null references voice.voice_transcript_sessions (id) on delete cascade,
  transcript_segment_id uuid not null references voice.voice_transcript_segments (id) on delete cascade,
  event_type text not null,
  confidence_score numeric(5,4) not null check (confidence_score >= 0 and confidence_score <= 1),
  evidence_text text not null,
  suggested_operator_action text not null default '',
  analysis_provider voice.voice_intelligence_analysis_provider not null default 'deterministic_rules',
  status voice.voice_intelligence_event_status not null default 'detected',
  metadata_json jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (transcript_segment_id, event_type)
);

create table if not exists voice.voice_buying_signal_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  voice_call_id uuid not null references voice.voice_calls (id) on delete cascade,
  transcript_session_id uuid not null references voice.voice_transcript_sessions (id) on delete cascade,
  transcript_segment_id uuid not null references voice.voice_transcript_segments (id) on delete cascade,
  event_type text not null,
  confidence_score numeric(5,4) not null check (confidence_score >= 0 and confidence_score <= 1),
  evidence_text text not null,
  suggested_operator_action text not null default '',
  analysis_provider voice.voice_intelligence_analysis_provider not null default 'deterministic_rules',
  status voice.voice_intelligence_event_status not null default 'detected',
  metadata_json jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (transcript_segment_id, event_type)
);

create table if not exists voice.voice_risk_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  voice_call_id uuid not null references voice.voice_calls (id) on delete cascade,
  transcript_session_id uuid not null references voice.voice_transcript_sessions (id) on delete cascade,
  transcript_segment_id uuid not null references voice.voice_transcript_segments (id) on delete cascade,
  event_type text not null,
  confidence_score numeric(5,4) not null check (confidence_score >= 0 and confidence_score <= 1),
  evidence_text text not null,
  suggested_operator_action text not null default '',
  analysis_provider voice.voice_intelligence_analysis_provider not null default 'deterministic_rules',
  status voice.voice_intelligence_event_status not null default 'detected',
  metadata_json jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (transcript_segment_id, event_type)
);

create table if not exists voice.voice_operator_guidance_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  voice_call_id uuid not null references voice.voice_calls (id) on delete cascade,
  transcript_session_id uuid not null references voice.voice_transcript_sessions (id) on delete cascade,
  transcript_segment_id uuid not null references voice.voice_transcript_segments (id) on delete cascade,
  event_type text not null,
  confidence_score numeric(5,4) not null check (confidence_score >= 0 and confidence_score <= 1),
  evidence_text text not null,
  suggested_operator_action text not null default '',
  analysis_provider voice.voice_intelligence_analysis_provider not null default 'deterministic_rules',
  status voice.voice_intelligence_event_status not null default 'detected',
  metadata_json jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (transcript_segment_id, event_type)
);

create table if not exists voice.voice_conversation_memory_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  voice_call_id uuid not null references voice.voice_calls (id) on delete cascade,
  transcript_session_id uuid references voice.voice_transcript_sessions (id) on delete set null,
  transcript_segment_id uuid references voice.voice_transcript_segments (id) on delete set null,
  intelligence_event_id uuid references voice.voice_conversation_intelligence_events (id) on delete set null,
  draft_kind text not null,
  draft_label text not null,
  draft_value text not null,
  evidence_text text not null,
  confidence_score numeric(5,4) not null check (confidence_score >= 0 and confidence_score <= 1),
  analysis_provider voice.voice_intelligence_analysis_provider not null default 'deterministic_rules',
  status voice.voice_memory_draft_status not null default 'pending_review',
  metadata_json jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_voice_conversation_intelligence_call_created
  on voice.voice_conversation_intelligence_events (voice_call_id, created_at desc);
create index if not exists idx_voice_objection_events_call_created
  on voice.voice_objection_events (voice_call_id, created_at desc);
create index if not exists idx_voice_buying_signal_events_call_created
  on voice.voice_buying_signal_events (voice_call_id, created_at desc);
create index if not exists idx_voice_risk_events_call_created
  on voice.voice_risk_events (voice_call_id, created_at desc);
create index if not exists idx_voice_operator_guidance_events_call_created
  on voice.voice_operator_guidance_events (voice_call_id, created_at desc);
create index if not exists idx_voice_conversation_memory_drafts_call_status
  on voice.voice_conversation_memory_drafts (voice_call_id, status, created_at desc);

comment on table voice.voice_conversation_intelligence_events is
  'Append-only passive transcript intelligence events for operator review.';
comment on table voice.voice_conversation_memory_drafts is
  'Pending-review conversation memory drafts — never auto-merged into CRM memory.';

alter table voice.voice_conversation_intelligence_events enable row level security;
alter table voice.voice_objection_events enable row level security;
alter table voice.voice_buying_signal_events enable row level security;
alter table voice.voice_risk_events enable row level security;
alter table voice.voice_operator_guidance_events enable row level security;
alter table voice.voice_conversation_memory_drafts enable row level security;

create policy voice_conversation_intelligence_events_select on voice.voice_conversation_intelligence_events
  for select to authenticated
  using (public.has_org_role (organization_id, array['owner', 'admin', 'manager', 'tech']));

create policy voice_objection_events_select on voice.voice_objection_events
  for select to authenticated
  using (public.has_org_role (organization_id, array['owner', 'admin', 'manager', 'tech']));

create policy voice_buying_signal_events_select on voice.voice_buying_signal_events
  for select to authenticated
  using (public.has_org_role (organization_id, array['owner', 'admin', 'manager', 'tech']));

create policy voice_risk_events_select on voice.voice_risk_events
  for select to authenticated
  using (public.has_org_role (organization_id, array['owner', 'admin', 'manager', 'tech']));

create policy voice_operator_guidance_events_select on voice.voice_operator_guidance_events
  for select to authenticated
  using (public.has_org_role (organization_id, array['owner', 'admin', 'manager', 'tech']));

create policy voice_conversation_memory_drafts_select on voice.voice_conversation_memory_drafts
  for select to authenticated
  using (public.has_org_role (organization_id, array['owner', 'admin', 'manager', 'tech']));

grant select on voice.voice_conversation_intelligence_events to authenticated;
grant select on voice.voice_objection_events to authenticated;
grant select on voice.voice_buying_signal_events to authenticated;
grant select on voice.voice_risk_events to authenticated;
grant select on voice.voice_operator_guidance_events to authenticated;
grant select on voice.voice_conversation_memory_drafts to authenticated;

grant all on voice.voice_conversation_intelligence_events to service_role;
grant all on voice.voice_objection_events to service_role;
grant all on voice.voice_buying_signal_events to service_role;
grant all on voice.voice_risk_events to service_role;
grant all on voice.voice_operator_guidance_events to service_role;
grant all on voice.voice_conversation_memory_drafts to service_role;
