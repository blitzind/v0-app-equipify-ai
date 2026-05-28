-- Phase 2D — Revenue intelligence + opportunity progression (evidence-backed, passive).
-- No autonomous CRM mutation. Append-only revenue events with operator lifecycle.

do $$
begin
  if to_regclass('voice.voice_relationship_memory_profiles') is null then
    raise exception 'Missing dependency: voice.voice_relationship_memory_profiles (apply Phase 2C first)';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_revenue_intelligence_event_type'
  ) then
    create type voice.voice_revenue_intelligence_event_type as enum (
      'stage_progression',
      'stage_regression',
      'deal_stalled',
      'deal_risk_increased',
      'deal_risk_reduced',
      'buying_intent_increased',
      'buying_intent_reduced',
      'follow_up_overdue',
      'decision_maker_engaged',
      'budget_objection_active',
      'competitor_risk_active',
      'timeline_slipping',
      'ready_to_book',
      'renewal_risk',
      'expansion_signal'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_buying_stage'
  ) then
    create type voice.voice_buying_stage as enum (
      'unknown',
      'discovery',
      'evaluation',
      'negotiation',
      'commitment',
      'stalled',
      'at_risk'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_momentum_direction'
  ) then
    create type voice.voice_momentum_direction as enum (
      'unknown',
      'accelerating',
      'stable',
      'decelerating',
      'reversing'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_revenue_intelligence_event_status'
  ) then
    create type voice.voice_revenue_intelligence_event_status as enum (
      'active',
      'acknowledged',
      'dismissed',
      'resolved',
      'expired'
    );
  end if;
end;
$$;

create table if not exists voice.voice_revenue_intelligence_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  related_customer_id uuid,
  related_prospect_id uuid,
  related_opportunity_id uuid,
  relationship_memory_profile_id uuid references voice.voice_relationship_memory_profiles (id) on delete set null,
  source_voice_call_id uuid references voice.voice_calls (id) on delete set null,
  source_memory_event_id uuid references voice.voice_relationship_memory_events (id) on delete set null,
  event_type voice.voice_revenue_intelligence_event_type not null,
  buying_stage voice.voice_buying_stage not null default 'unknown',
  momentum_direction voice.voice_momentum_direction not null default 'unknown',
  confidence_score numeric(5,4) not null check (confidence_score >= 0 and confidence_score <= 1),
  evidence_text text not null,
  recommended_operator_action text,
  status voice.voice_revenue_intelligence_event_status not null default 'active',
  created_at timestamptz not null default now()
);

comment on table voice.voice_revenue_intelligence_events is
  'Append-only revenue intelligence events. Evidence-linked, operator lifecycle, no autonomous CRM writes.';

create index if not exists idx_voice_revenue_intelligence_events_org_profile_created
  on voice.voice_revenue_intelligence_events (organization_id, relationship_memory_profile_id, created_at desc);

create index if not exists idx_voice_revenue_intelligence_events_org_status
  on voice.voice_revenue_intelligence_events (organization_id, status, event_type);

create index if not exists idx_voice_revenue_intelligence_events_opportunity
  on voice.voice_revenue_intelligence_events (organization_id, related_opportunity_id, created_at desc)
  where related_opportunity_id is not null;

alter table voice.voice_revenue_intelligence_events enable row level security;

create policy voice_revenue_intelligence_events_select on voice.voice_revenue_intelligence_events
  for select to authenticated
  using (
    organization_id in (
      select om.organization_id from public.organization_members om where om.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on voice.voice_revenue_intelligence_events to service_role;
