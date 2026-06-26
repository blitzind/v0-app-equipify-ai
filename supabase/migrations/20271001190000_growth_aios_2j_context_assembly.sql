-- GE-AIOS-2J — Context Assembly foundation (Equipify AI OS).
-- Constitutional reference: AI Revenue Operator Constitution v1.0 §14.
-- Read-only context gathering into immutable Context Packages — NOT LLMs, providers, or execution.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regclass('growth.ai_work_orders') is null then
    raise exception 'Missing dependency: growth.ai_work_orders — apply GE-AIOS-2A migration first';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.ai_context_assembly_runtime — org-level assembly health counters
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_context_assembly_runtime (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations (id) on delete cascade,

  assembly_count int not null default 0 check (assembly_count >= 0),
  reuse_count int not null default 0 check (reuse_count >= 0),
  validation_failure_count int not null default 0 check (validation_failure_count >= 0),

  last_assembled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  qa_marker text not null default 'growth-aios-2j-context-assembly-v1',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table growth.ai_context_assembly_runtime is
  'GE-AIOS-2J Context Assembly runtime counters — read-only assembly health.';

-- -----------------------------------------------------------------------------
-- growth.ai_context_packages — immutable assembled context (append-only)
-- -----------------------------------------------------------------------------

create table if not exists growth.ai_context_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  mission_id uuid not null,
  work_order_id uuid not null references growth.ai_work_orders (id) on delete cascade,

  context_version text not null default '1.0',
  checksum text not null,

  work_order_context jsonb not null default '{}'::jsonb,
  mission_context jsonb,
  decision_history jsonb not null default '[]'::jsonb,
  memory_references jsonb not null default '[]'::jsonb,
  related_events jsonb not null default '[]'::jsonb,
  evidence_bundle jsonb not null default '[]'::jsonb,
  entity_metadata jsonb,
  source_keys jsonb not null default '[]'::jsonb,

  reused_from_package_id uuid references growth.ai_context_packages (id) on delete set null,

  qa_marker text not null default 'growth-aios-2j-context-assembly-v1',
  created_at timestamptz not null default now()
);

create index if not exists ai_context_packages_work_order_idx
  on growth.ai_context_packages (organization_id, work_order_id, created_at desc);

create index if not exists ai_context_packages_checksum_idx
  on growth.ai_context_packages (organization_id, work_order_id, context_version, checksum);

comment on table growth.ai_context_packages is
  'GE-AIOS-2J immutable Context Packages — references existing stores, no source duplication.';

drop trigger if exists trg_growth_ai_context_assembly_runtime_updated_at
  on growth.ai_context_assembly_runtime;
create trigger trg_growth_ai_context_assembly_runtime_updated_at
  before update on growth.ai_context_assembly_runtime
  for each row execute function public.set_updated_at();

revoke all on table growth.ai_context_assembly_runtime from public, anon, authenticated;
revoke all on table growth.ai_context_packages from public, anon, authenticated;

grant select, insert, update on table growth.ai_context_assembly_runtime to service_role;
grant select, insert on table growth.ai_context_packages to service_role;

alter table growth.ai_context_assembly_runtime enable row level security;
alter table growth.ai_context_assembly_runtime force row level security;
alter table growth.ai_context_packages enable row level security;
alter table growth.ai_context_packages force row level security;

drop policy if exists ai_context_assembly_runtime_service_role on growth.ai_context_assembly_runtime;
create policy ai_context_assembly_runtime_service_role
  on growth.ai_context_assembly_runtime for all to service_role using (true) with check (true);

drop policy if exists ai_context_packages_service_role on growth.ai_context_packages;
create policy ai_context_packages_service_role
  on growth.ai_context_packages for all to service_role using (true) with check (true);
