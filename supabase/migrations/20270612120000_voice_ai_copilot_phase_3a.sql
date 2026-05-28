-- Phase 3A — Live AI Copilot participation (suggestion-only, operator-controlled).
-- AI assists operators with evidence-backed drafts. No autonomous customer actions.

do $$
begin
  if to_regclass('voice.voice_retention_intelligence_events') is null then
    raise exception 'Missing dependency: voice.voice_retention_intelligence_events (apply Phase 2E first)';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_ai_copilot_suggestion_type'
  ) then
    create type voice.voice_ai_copilot_suggestion_type as enum (
      'objection_response',
      'next_best_response',
      'discovery_question',
      'booking_prompt',
      'escalation_recommendation',
      'compliance_reminder',
      'call_note_draft',
      'live_summary_draft',
      'follow_up_draft',
      'retention_response',
      'expansion_response'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_ai_copilot_suggestion_status'
  ) then
    create type voice.voice_ai_copilot_suggestion_status as enum (
      'active',
      'acknowledged',
      'dismissed',
      'copied',
      'expired'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_ai_copilot_provider'
  ) then
    create type voice.voice_ai_copilot_provider as enum (
      'deterministic_template',
      'openai',
      'stub'
    );
  end if;
end;
$$;

create table if not exists voice.voice_ai_copilot_suggestions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  voice_call_id uuid not null references voice.voice_calls (id) on delete cascade,
  relationship_memory_profile_id uuid references voice.voice_relationship_memory_profiles (id) on delete set null,
  related_customer_id uuid,
  related_prospect_id uuid,
  related_opportunity_id uuid,
  suggestion_type voice.voice_ai_copilot_suggestion_type not null,
  priority smallint not null default 50 check (priority >= 0 and priority <= 100),
  title text not null,
  body text not null,
  evidence_text text not null,
  source_event_ids_json jsonb not null default '[]'::jsonb,
  status voice.voice_ai_copilot_suggestion_status not null default 'active',
  generated_by_provider voice.voice_ai_copilot_provider not null default 'deterministic_template',
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  dismissed_at timestamptz,
  copied_at timestamptz
);

comment on table voice.voice_ai_copilot_suggestions is
  'Live AI copilot suggestions for operators. Evidence-linked, operator lifecycle, no autonomous actions.';

create index if not exists idx_voice_ai_copilot_suggestions_org_call_created
  on voice.voice_ai_copilot_suggestions (organization_id, voice_call_id, created_at desc);

create index if not exists idx_voice_ai_copilot_suggestions_org_call_status
  on voice.voice_ai_copilot_suggestions (organization_id, voice_call_id, status, suggestion_type);

create index if not exists idx_voice_ai_copilot_suggestions_profile
  on voice.voice_ai_copilot_suggestions (organization_id, relationship_memory_profile_id, created_at desc)
  where relationship_memory_profile_id is not null;

alter table voice.voice_ai_copilot_suggestions enable row level security;

create policy voice_ai_copilot_suggestions_select on voice.voice_ai_copilot_suggestions
  for select to authenticated
  using (
    organization_id in (
      select om.organization_id from public.organization_members om where om.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on voice.voice_ai_copilot_suggestions to service_role;
