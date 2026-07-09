-- GE-AIOS-17B — Server-side organizational memory (Ava Memory Engine persistence).
-- Service-role only. Mirrors AvaMemoryEvent / AvaOrganizationalPreference shapes from GE-AIOS-12A.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.organization_memory_events
-- -----------------------------------------------------------------------------

create table if not exists growth.organization_memory_events (
  memory_event_id text not null,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  category text not null,
  event_source text not null,
  specialist text,
  event_type text,
  entity_type text not null,
  entity_id text not null,
  summary text not null,
  confidence numeric,
  importance integer not null default 3 check (importance >= 1 and importance <= 5),
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  narrative_visibility boolean not null default true,
  expires_at timestamptz,
  qa_marker text not null default 'ge-aios-17b-server-organizational-memory-v1',
  created_at timestamptz not null default now(),
  constraint organization_memory_events_org_event_pkey primary key (organization_id, memory_event_id)
);

create index if not exists idx_growth_organization_memory_events_org_occurred
  on growth.organization_memory_events (organization_id, occurred_at desc);

create index if not exists idx_growth_organization_memory_events_org_source
  on growth.organization_memory_events (organization_id, event_source, occurred_at desc);

comment on table growth.organization_memory_events is
  'GE-AIOS-17B — Durable org-scoped Ava memory events (validated business events only).';

-- -----------------------------------------------------------------------------
-- growth.organization_memory_preferences
-- -----------------------------------------------------------------------------

create table if not exists growth.organization_memory_preferences (
  preference_id text not null,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  preference_key text not null,
  statement text not null,
  importance integer not null default 3 check (importance >= 1 and importance <= 5),
  source text not null,
  captured_at timestamptz not null,
  qa_marker text not null default 'ge-aios-17b-server-organizational-memory-v1',
  created_at timestamptz not null default now(),
  constraint organization_memory_preferences_org_pref_pkey primary key (organization_id, preference_id)
);

create index if not exists idx_growth_organization_memory_preferences_org_captured
  on growth.organization_memory_preferences (organization_id, captured_at desc);

comment on table growth.organization_memory_preferences is
  'GE-AIOS-17B — Durable org-scoped Ava organizational preferences.';

-- -----------------------------------------------------------------------------
-- Grants + RLS (service_role only)
-- -----------------------------------------------------------------------------

grant select, insert, update, delete on table growth.organization_memory_events to service_role;
grant select, insert, update, delete on table growth.organization_memory_preferences to service_role;

alter table growth.organization_memory_events enable row level security;
alter table growth.organization_memory_events force row level security;

alter table growth.organization_memory_preferences enable row level security;
alter table growth.organization_memory_preferences force row level security;

drop policy if exists growth_organization_memory_events_service_role on growth.organization_memory_events;
create policy growth_organization_memory_events_service_role
  on growth.organization_memory_events for all to service_role using (true) with check (true);

drop policy if exists growth_organization_memory_preferences_service_role on growth.organization_memory_preferences;
create policy growth_organization_memory_preferences_service_role
  on growth.organization_memory_preferences for all to service_role using (true) with check (true);
