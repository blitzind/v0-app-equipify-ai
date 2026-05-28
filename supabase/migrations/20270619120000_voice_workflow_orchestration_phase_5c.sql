-- Phase 5C — Workflow Orchestration Intelligence.
-- Coordination + visibility only — no autonomous workflow execution.

do $$
begin
  if to_regclass('voice.voice_observability_events') is null then
    raise exception 'Missing dependency: voice.voice_observability_events (apply Phase 5B first)';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_workflow_orchestration_type'
  ) then
    create type voice.voice_workflow_orchestration_type as enum (
      'missed_call_recovery',
      'callback_followup',
      'appointment_coordination',
      'escalation_recovery',
      'ai_receptionist_handoff',
      'outbound_followup',
      'retention_recovery',
      'expansion_followup',
      'unresolved_objection',
      'compliance_hold',
      'operator_takeover',
      'scheduling_followup'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_workflow_orchestration_status'
  ) then
    create type voice.voice_workflow_orchestration_status as enum (
      'pending',
      'active',
      'awaiting_operator',
      'awaiting_customer',
      'compliance_hold',
      'escalated',
      'blocked',
      'completed',
      'canceled',
      'expired'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_workflow_orchestration_event_type'
  ) then
    create type voice.voice_workflow_orchestration_event_type as enum (
      'workflow_created',
      'workflow_assigned',
      'escalation_triggered',
      'operator_joined',
      'compliance_hold_added',
      'customer_response_received',
      'callback_scheduled',
      'followup_recommended',
      'workflow_blocked',
      'workflow_resolved',
      'workflow_expired',
      'operator_override',
      'ai_handoff_completed',
      'routing_recommendation_generated',
      'stalled_detected',
      'channel_transition_recorded'
    );
  end if;
end;
$$;

create table if not exists voice.voice_workflow_orchestrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  orchestration_type voice.voice_workflow_orchestration_type not null,
  orchestration_status voice.voice_workflow_orchestration_status not null default 'pending',
  priority integer not null default 50,
  source_session_id uuid,
  source_call_id uuid,
  source_campaign_id uuid,
  relationship_memory_profile_id uuid,
  related_customer_id uuid,
  related_prospect_id uuid,
  related_opportunity_id uuid,
  assigned_operator_id uuid,
  escalation_level integer not null default 0,
  compliance_state text,
  next_recommended_action text,
  blocked_reason text,
  orchestration_summary text not null default '',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

comment on table voice.voice_workflow_orchestrations is
  'Workflow orchestration intelligence — operator-controlled coordination, no autonomous execution.';

create index if not exists idx_voice_workflow_orchestrations_org_status
  on voice.voice_workflow_orchestrations (organization_id, orchestration_status, updated_at desc);

create index if not exists idx_voice_workflow_orchestrations_org_type
  on voice.voice_workflow_orchestrations (organization_id, orchestration_type, created_at desc);

create table if not exists voice.voice_workflow_orchestration_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  orchestration_id uuid not null references voice.voice_workflow_orchestrations (id) on delete cascade,
  event_type voice.voice_workflow_orchestration_event_type not null,
  source_system text not null default '',
  evidence_text text not null default '',
  linked_session_id uuid,
  linked_call_id uuid,
  payload_json jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

comment on table voice.voice_workflow_orchestration_events is
  'Append-only workflow orchestration timeline — evidence-linked, replayable.';

create index if not exists idx_voice_workflow_orchestration_events_orch_created
  on voice.voice_workflow_orchestration_events (orchestration_id, created_at desc);

alter table voice.voice_workflow_orchestrations enable row level security;
alter table voice.voice_workflow_orchestration_events enable row level security;

create policy voice_workflow_orchestrations_select on voice.voice_workflow_orchestrations
  for select to authenticated
  using (organization_id in (select om.organization_id from public.organization_members om where om.user_id = auth.uid()));

create policy voice_workflow_orchestration_events_select on voice.voice_workflow_orchestration_events
  for select to authenticated
  using (organization_id in (select om.organization_id from public.organization_members om where om.user_id = auth.uid()));

grant select, insert, update on voice.voice_workflow_orchestrations to service_role;
grant select, insert on voice.voice_workflow_orchestration_events to service_role;
