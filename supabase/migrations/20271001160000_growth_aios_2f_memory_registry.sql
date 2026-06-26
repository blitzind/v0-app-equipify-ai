-- GE-AIOS-2F — Memory Registry foundation (Equipify AI OS).
-- Constitutional reference: AI Revenue Operator Constitution v1.0 §8, §16.3.
-- Metadata-only registry referencing existing Growth stores — NOT vector search, embeddings, RAG, or Learning Engine.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regclass('growth.organization_growth_objectives') is null then
    raise exception 'Missing dependency: growth.organization_growth_objectives';
  end if;
  if to_regclass('growth.ai_work_orders') is null then
    raise exception 'Missing dependency: growth.ai_work_orders — apply GE-AIOS-2A migration first';
  end if;
  if to_regclass('growth.ai_decision_records') is null then
    raise exception 'Missing dependency: growth.ai_decision_records — apply GE-AIOS-2D migration first';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.ai_memory_registry — constitutional memory metadata registry
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_memory_registry (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  mission_id uuid references growth.organization_growth_objectives (id) on delete set null,

  memory_type text not null,
  owner_agent text not null,

  entity_type text,
  entity_id uuid,

  source_system text not null,
  source_table text not null,
  source_record_id uuid,
  source_key text,

  label text not null default '',
  description text not null default '',

  lifecycle_status text not null default 'created',
  retention_policy text not null default 'standard',
  privacy_scope text not null default 'mission',

  schema_version text not null default '1.0',
  audit_metadata jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-aios-2f-memory-registry-v1',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  referenced_at timestamptz,
  archived_at timestamptz,

  constraint ai_memory_registry_memory_type_check check (
    memory_type in (
      'organization',
      'mission',
      'company',
      'lead',
      'relationship',
      'conversation',
      'research',
      'decision',
      'provider',
      'playbook',
      'strategy'
    )
  ),
  constraint ai_memory_registry_owner_agent_check check (
    owner_agent in (
      'prospecting',
      'research',
      'qualification',
      'strategy',
      'personalization',
      'outreach',
      'conversation',
      'meeting',
      'opportunity',
      'learning',
      'executive_reporting',
      'compliance',
      'budget',
      'provider',
      'warmup',
      'deliverability',
      'executive_brain'
    )
  ),
  constraint ai_memory_registry_lifecycle_status_check check (
    lifecycle_status in (
      'observed',
      'created',
      'active',
      'referenced',
      'archived',
      'forgotten'
    )
  ),
  constraint ai_memory_registry_retention_policy_check check (
    retention_policy in ('standard', 'permanent')
  ),
  constraint ai_memory_registry_privacy_scope_check check (
    privacy_scope in ('organization', 'mission', 'entity')
  ),
  constraint ai_memory_registry_source_ref_check check (
    source_record_id is not null or nullif(source_key, '') is not null
  )
);

create index if not exists ai_memory_registry_org_mission_idx
  on growth.ai_memory_registry (organization_id, mission_id, created_at desc);

create index if not exists ai_memory_registry_org_type_idx
  on growth.ai_memory_registry (organization_id, memory_type, lifecycle_status, created_at desc);

create index if not exists ai_memory_registry_entity_idx
  on growth.ai_memory_registry (organization_id, entity_type, entity_id, created_at desc)
  where entity_type is not null and entity_id is not null;

create unique index if not exists ai_memory_registry_source_record_unique_idx
  on growth.ai_memory_registry (organization_id, source_table, source_record_id)
  where source_record_id is not null;

create unique index if not exists ai_memory_registry_source_key_unique_idx
  on growth.ai_memory_registry (organization_id, source_table, source_key)
  where source_record_id is null and nullif(source_key, '') is not null;

comment on table growth.ai_memory_registry is
  'AI OS Memory Registry — metadata and references to existing Growth memory stores; does not duplicate source payloads.';

-- -----------------------------------------------------------------------------
-- growth.ai_memory_registry_events — lifecycle audit trail
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_memory_registry_events (
  id uuid primary key default gen_random_uuid(),
  memory_registry_id uuid not null references growth.ai_memory_registry (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  event_type text not null,
  work_order_id uuid references growth.ai_work_orders (id) on delete set null,
  decision_record_id uuid references growth.ai_decision_records (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint ai_memory_registry_events_event_type_check check (
    event_type in ('created', 'updated', 'referenced', 'linked', 'archived')
  )
);

create index if not exists ai_memory_registry_events_memory_idx
  on growth.ai_memory_registry_events (memory_registry_id, created_at desc);

create index if not exists ai_memory_registry_events_org_idx
  on growth.ai_memory_registry_events (organization_id, created_at desc);

comment on table growth.ai_memory_registry_events is
  'Append-only Memory Registry lifecycle audit — references Work Orders and Decision Records when linked.';

-- -----------------------------------------------------------------------------
-- Grants — service role only (Growth / AI OS infrastructure)
-- -----------------------------------------------------------------------------

revoke all on table growth.ai_memory_registry from public, anon, authenticated;
revoke all on table growth.ai_memory_registry_events from public, anon, authenticated;

grant select, insert, update on table growth.ai_memory_registry to service_role;
grant select, insert on table growth.ai_memory_registry_events to service_role;

alter table growth.ai_memory_registry enable row level security;
alter table growth.ai_memory_registry force row level security;
alter table growth.ai_memory_registry_events enable row level security;
alter table growth.ai_memory_registry_events force row level security;

drop policy if exists ai_memory_registry_service_role on growth.ai_memory_registry;
create policy ai_memory_registry_service_role
  on growth.ai_memory_registry for all to service_role using (true) with check (true);

drop policy if exists ai_memory_registry_events_service_role on growth.ai_memory_registry_events;
create policy ai_memory_registry_events_service_role
  on growth.ai_memory_registry_events for all to service_role using (true) with check (true);
