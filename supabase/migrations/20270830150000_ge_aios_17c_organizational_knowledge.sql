-- GE-AIOS-17C — Durable organizational knowledge (conclusions derived from Evidence → BI → Memory).
-- Service-role only. Extends GE-AIOS-17B memory storage — not a duplicate memory engine.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.organization_knowledge
-- -----------------------------------------------------------------------------

create table if not exists growth.organization_knowledge (
  knowledge_id text not null,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  source text not null,
  specialist text,
  category text not null,
  finding text not null,
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 100),
  supporting_event_count integer not null default 0 check (supporting_event_count >= 0),
  first_observed_at timestamptz not null,
  last_confirmed_at timestamptz not null,
  superseded_by text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'ge-aios-17c-organizational-knowledge-v1',
  created_at timestamptz not null default now(),
  constraint organization_knowledge_org_item_pkey primary key (organization_id, knowledge_id)
);

create index if not exists idx_growth_organization_knowledge_org_active
  on growth.organization_knowledge (organization_id, active, last_confirmed_at desc);

create index if not exists idx_growth_organization_knowledge_org_category
  on growth.organization_knowledge (organization_id, category, last_confirmed_at desc);

comment on table growth.organization_knowledge is
  'GE-AIOS-17C — Durable org-scoped business knowledge (validated conclusions, not raw events).';

-- -----------------------------------------------------------------------------
-- Grants + RLS (service_role only)
-- -----------------------------------------------------------------------------

grant select, insert, update, delete on table growth.organization_knowledge to service_role;

alter table growth.organization_knowledge enable row level security;
alter table growth.organization_knowledge force row level security;

drop policy if exists growth_organization_knowledge_service_role on growth.organization_knowledge;
create policy growth_organization_knowledge_service_role
  on growth.organization_knowledge for all to service_role using (true) with check (true);
