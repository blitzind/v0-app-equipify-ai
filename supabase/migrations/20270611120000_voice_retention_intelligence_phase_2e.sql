-- Phase 2E — Retention + expansion intelligence (evidence-backed, passive).
-- No autonomous customer/account mutation. Append-only events with operator lifecycle.

do $$
begin
  if to_regclass('voice.voice_revenue_intelligence_events') is null then
    raise exception 'Missing dependency: voice.voice_revenue_intelligence_events (apply Phase 2D first)';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_retention_intelligence_event_type'
  ) then
    create type voice.voice_retention_intelligence_event_type as enum (
      'churn_risk_increased',
      'churn_risk_reduced',
      'unresolved_issue_active',
      'satisfaction_signal',
      'dissatisfaction_signal',
      'renewal_risk',
      'renewal_confidence_increased',
      'expansion_signal',
      'cross_sell_signal',
      'upsell_signal',
      'referral_signal',
      'service_gap_detected',
      'relationship_strengthened',
      'relationship_weakened',
      'follow_up_needed',
      'escalation_required'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_health_direction'
  ) then
    create type voice.voice_health_direction as enum (
      'unknown',
      'improving',
      'stable',
      'declining',
      'at_risk'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_retention_intelligence_event_status'
  ) then
    create type voice.voice_retention_intelligence_event_status as enum (
      'active',
      'acknowledged',
      'dismissed',
      'resolved',
      'expired'
    );
  end if;
end;
$$;

create table if not exists voice.voice_retention_intelligence_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  related_customer_id uuid,
  related_prospect_id uuid,
  related_opportunity_id uuid,
  relationship_memory_profile_id uuid references voice.voice_relationship_memory_profiles (id) on delete set null,
  source_voice_call_id uuid references voice.voice_calls (id) on delete set null,
  source_memory_event_id uuid references voice.voice_relationship_memory_events (id) on delete set null,
  source_revenue_event_id uuid references voice.voice_revenue_intelligence_events (id) on delete set null,
  event_type voice.voice_retention_intelligence_event_type not null,
  health_direction voice.voice_health_direction not null default 'unknown',
  confidence_score numeric(5,4) not null check (confidence_score >= 0 and confidence_score <= 1),
  evidence_text text not null,
  recommended_operator_action text,
  status voice.voice_retention_intelligence_event_status not null default 'active',
  created_at timestamptz not null default now()
);

comment on table voice.voice_retention_intelligence_events is
  'Append-only retention/expansion intelligence. Evidence-linked, operator lifecycle, no autonomous account actions.';

create index if not exists idx_voice_retention_intelligence_events_org_profile_created
  on voice.voice_retention_intelligence_events (organization_id, relationship_memory_profile_id, created_at desc);

create index if not exists idx_voice_retention_intelligence_events_org_status
  on voice.voice_retention_intelligence_events (organization_id, status, event_type);

create index if not exists idx_voice_retention_intelligence_events_customer
  on voice.voice_retention_intelligence_events (organization_id, related_customer_id, created_at desc)
  where related_customer_id is not null;

alter table voice.voice_retention_intelligence_events enable row level security;

create policy voice_retention_intelligence_events_select on voice.voice_retention_intelligence_events
  for select to authenticated
  using (
    organization_id in (
      select om.organization_id from public.organization_members om where om.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on voice.voice_retention_intelligence_events to service_role;
