-- Phase 5B — Voice Intelligence Observability + Orchestration Analytics.
-- Operational visibility only — no autonomous remediation or provider auto-switching.

do $$
begin
  if to_regclass('voice.voice_ai_outbound_sessions') is null then
    raise exception 'Missing dependency: voice.voice_ai_outbound_sessions (apply Phase 5A first)';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_observability_event_category'
  ) then
    create type voice.voice_observability_event_category as enum (
      'provider',
      'ai_orchestration',
      'compliance',
      'campaign',
      'transfer',
      'escalation',
      'operator',
      'receptionist',
      'outbound_ai',
      'transcript',
      'realtime_media',
      'retention',
      'revenue'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_observability_severity'
  ) then
    create type voice.voice_observability_severity as enum ('info', 'warning', 'critical');
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_observability_alert_status'
  ) then
    create type voice.voice_observability_alert_status as enum ('active', 'resolved', 'suppressed');
  end if;
end;
$$;

create table if not exists voice.voice_observability_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  event_category voice.voice_observability_event_category not null,
  event_type text not null,
  severity voice.voice_observability_severity not null default 'info',
  source_system text not null default '',
  source_session_id uuid,
  source_call_id uuid,
  source_campaign_id uuid,
  source_provider text,
  relationship_memory_profile_id uuid,
  related_customer_id uuid,
  related_prospect_id uuid,
  latency_ms integer,
  duration_ms integer,
  evidence_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table voice.voice_observability_events is
  'Append-only voice observability events — no transcript payload duplication.';

create index if not exists idx_voice_observability_events_org_created
  on voice.voice_observability_events (organization_id, created_at desc);

create index if not exists idx_voice_observability_events_org_category_created
  on voice.voice_observability_events (organization_id, event_category, created_at desc);

create table if not exists voice.voice_observability_alert_states (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  alert_key text not null,
  alert_type text not null,
  severity voice.voice_observability_severity not null default 'warning',
  status voice.voice_observability_alert_status not null default 'active',
  evidence_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  triggered_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, alert_key)
);

comment on table voice.voice_observability_alert_states is
  'Passive alert state tracking — visibility only, no external dispatch or auto-remediation.';

create index if not exists idx_voice_observability_alerts_org_status
  on voice.voice_observability_alert_states (organization_id, status, triggered_at desc);

create table if not exists voice.voice_observability_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  snapshot_type text not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table voice.voice_observability_metric_snapshots is
  'Rolling aggregation snapshots — capped payloads, no transcript duplication.';

create index if not exists idx_voice_observability_snapshots_org_type_created
  on voice.voice_observability_metric_snapshots (organization_id, snapshot_type, created_at desc);

alter table voice.voice_observability_events enable row level security;
alter table voice.voice_observability_alert_states enable row level security;
alter table voice.voice_observability_metric_snapshots enable row level security;

create policy voice_observability_events_select on voice.voice_observability_events
  for select to authenticated
  using (organization_id in (select om.organization_id from public.organization_members om where om.user_id = auth.uid()));

create policy voice_observability_alerts_select on voice.voice_observability_alert_states
  for select to authenticated
  using (organization_id in (select om.organization_id from public.organization_members om where om.user_id = auth.uid()));

create policy voice_observability_snapshots_select on voice.voice_observability_metric_snapshots
  for select to authenticated
  using (organization_id in (select om.organization_id from public.organization_members om where om.user_id = auth.uid()));

grant select, insert on voice.voice_observability_events to service_role;
grant select, insert, update on voice.voice_observability_alert_states to service_role;
grant select, insert, delete on voice.voice_observability_metric_snapshots to service_role;
