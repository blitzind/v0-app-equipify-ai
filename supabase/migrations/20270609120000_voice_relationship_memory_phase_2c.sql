-- Phase 2C — Relationship-scoped conversation memory (cross-call intelligence).
-- Evidence-backed, operator-reviewed, append-only events. No autonomous CRM mutation.

do $$
begin
  if to_regclass('voice.voice_conversation_memory_drafts') is null then
    raise exception 'Missing dependency: voice.voice_conversation_memory_drafts (apply Phase 2A first)';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_relationship_status'
  ) then
    create type voice.voice_relationship_status as enum (
      'new',
      'active',
      'nurturing',
      'at_risk',
      'escalated',
      'dormant'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_relationship_sentiment_trend'
  ) then
    create type voice.voice_relationship_sentiment_trend as enum (
      'unknown',
      'improving',
      'stable',
      'declining',
      'volatile'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_relationship_memory_type'
  ) then
    create type voice.voice_relationship_memory_type as enum (
      'pricing_objection',
      'competitor_mention',
      'callback_preference',
      'preferred_channel',
      'decision_maker',
      'budget_concern',
      'urgency_signal',
      'cancellation_risk',
      'follow_up_request',
      'scheduling_preference',
      'escalation_pattern',
      'positive_sentiment',
      'negative_sentiment',
      'booking_interest'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_relationship_memory_event_status'
  ) then
    create type voice.voice_relationship_memory_event_status as enum (
      'active',
      'superseded',
      'expired',
      'merged'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_relationship_memory_created_by_source'
  ) then
    create type voice.voice_relationship_memory_created_by_source as enum (
      'draft_accept',
      'draft_merge',
      'manual',
      'call_aggregation',
      'intelligence_sync'
    );
  end if;
end;
$$;

create table if not exists voice.voice_relationship_memory_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  related_customer_id uuid,
  related_prospect_id uuid,
  primary_contact_name text,
  primary_phone_number text not null default '',
  relationship_status voice.voice_relationship_status not null default 'new',
  first_interaction_at timestamptz,
  last_interaction_at timestamptz,
  total_call_count int not null default 0 check (total_call_count >= 0),
  total_talk_time_seconds int not null default 0 check (total_talk_time_seconds >= 0),
  objection_count int not null default 0 check (objection_count >= 0),
  buying_signal_count int not null default 0 check (buying_signal_count >= 0),
  escalation_count int not null default 0 check (escalation_count >= 0),
  sentiment_trend voice.voice_relationship_sentiment_trend not null default 'unknown',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table voice.voice_relationship_memory_profiles is
  'Canonical long-term relationship memory anchor. Org-scoped, evidence-backed, operator reviewable.';

create unique index if not exists idx_voice_relationship_memory_profiles_org_phone
  on voice.voice_relationship_memory_profiles (organization_id, primary_phone_number)
  where char_length(trim(primary_phone_number)) > 0;

create index if not exists idx_voice_relationship_memory_profiles_org_updated
  on voice.voice_relationship_memory_profiles (organization_id, updated_at desc);

create table if not exists voice.voice_relationship_memory_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  memory_profile_id uuid not null references voice.voice_relationship_memory_profiles (id) on delete cascade,
  source_voice_call_id uuid references voice.voice_calls (id) on delete set null,
  source_transcript_segment_id uuid references voice.voice_transcript_segments (id) on delete set null,
  memory_type voice.voice_relationship_memory_type not null,
  evidence_text text not null,
  confidence_score numeric(5,4) not null check (confidence_score >= 0 and confidence_score <= 1),
  event_status voice.voice_relationship_memory_event_status not null default 'active',
  created_by_source voice.voice_relationship_memory_created_by_source not null default 'draft_accept',
  created_at timestamptz not null default now()
);

comment on table voice.voice_relationship_memory_events is
  'Append-only relationship memory events. Never silently merged — operator review required.';

create index if not exists idx_voice_relationship_memory_events_profile_created
  on voice.voice_relationship_memory_events (memory_profile_id, created_at desc);

create index if not exists idx_voice_relationship_memory_events_org_type
  on voice.voice_relationship_memory_events (organization_id, memory_type, event_status);

alter table voice.voice_conversation_memory_drafts
  add column if not exists operator_notes text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by_user_id uuid references auth.users (id) on delete set null,
  add column if not exists merged_memory_event_id uuid references voice.voice_relationship_memory_events (id) on delete set null,
  add column if not exists expires_at timestamptz;

alter table voice.voice_relationship_memory_profiles enable row level security;
alter table voice.voice_relationship_memory_events enable row level security;

create policy voice_relationship_memory_profiles_select on voice.voice_relationship_memory_profiles
  for select to authenticated
  using (
    organization_id in (
      select om.organization_id from public.organization_members om where om.user_id = auth.uid()
    )
  );

create policy voice_relationship_memory_events_select on voice.voice_relationship_memory_events
  for select to authenticated
  using (
    organization_id in (
      select om.organization_id from public.organization_members om where om.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on voice.voice_relationship_memory_profiles to service_role;
grant select, insert, update, delete on voice.voice_relationship_memory_events to service_role;
