-- Growth Engine S5-B — Automation Visual Builder persistence foundation.
-- Draft flow storage, versioning, nodes/edges, validation results. No compiler or execution.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'Missing dependency: public.set_updated_at()';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.automation_flows
-- -----------------------------------------------------------------------------

create table if not exists growth.automation_flows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  description text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  current_version_id uuid,
  published_version_id uuid,
  qa_marker text not null default 'growth-automation-builder-s5b-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists idx_growth_automation_flows_organization
  on growth.automation_flows (organization_id, status, updated_at desc);

create index if not exists idx_growth_automation_flows_status
  on growth.automation_flows (status, updated_at desc);

comment on table growth.automation_flows is
  'Automation visual builder flows — draft/publish/archive only; no autonomous execution.';

-- -----------------------------------------------------------------------------
-- growth.automation_flow_versions
-- -----------------------------------------------------------------------------

create table if not exists growth.automation_flow_versions (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references growth.automation_flows (id) on delete cascade,
  version_number integer not null check (version_number > 0),
  lifecycle text not null default 'draft'
    check (lifecycle in ('draft', 'published', 'superseded')),
  canvas_layout_json jsonb not null default '{}'::jsonb,
  compiled_pattern_id uuid references growth.sequence_patterns (id) on delete set null,
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (flow_id, version_number)
);

create index if not exists idx_growth_automation_flow_versions_flow
  on growth.automation_flow_versions (flow_id, version_number desc);

create index if not exists idx_growth_automation_flow_versions_lifecycle
  on growth.automation_flow_versions (lifecycle, created_at desc);

comment on table growth.automation_flow_versions is
  'Versioned automation canvas snapshots — compiler output reserved for future phases.';

-- -----------------------------------------------------------------------------
-- growth.automation_nodes
-- -----------------------------------------------------------------------------

create table if not exists growth.automation_nodes (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references growth.automation_flow_versions (id) on delete cascade,
  node_type text not null check (node_type in (
    'trigger', 'condition', 'wait', 'branch', 'action', 'approval', 'exit'
  )),
  label text not null default '' check (char_length(label) <= 160),
  position_x numeric not null default 0,
  position_y numeric not null default 0,
  config_json jsonb not null default '{}'::jsonb,
  validation_state text not null default 'pending'
    check (validation_state in ('pending', 'valid', 'warning', 'error')),
  compiled_pattern_step_id uuid references growth.sequence_pattern_steps (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_automation_nodes_version
  on growth.automation_nodes (version_id, node_type);

-- -----------------------------------------------------------------------------
-- growth.automation_edges
-- -----------------------------------------------------------------------------

create table if not exists growth.automation_edges (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references growth.automation_flow_versions (id) on delete cascade,
  from_node_id uuid not null references growth.automation_nodes (id) on delete cascade,
  to_node_id uuid not null references growth.automation_nodes (id) on delete cascade,
  edge_type text not null default 'default' check (edge_type in (
    'default', 'conditional_true', 'conditional_false', 'timeout', 'fallback'
  )),
  priority int not null default 0 check (priority >= 0),
  condition_id uuid references growth.sequence_pattern_step_conditions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_node_id <> to_node_id)
);

create index if not exists idx_growth_automation_edges_version
  on growth.automation_edges (version_id, priority desc);

create index if not exists idx_growth_automation_edges_from
  on growth.automation_edges (from_node_id);

create index if not exists idx_growth_automation_edges_to
  on growth.automation_edges (to_node_id);

-- -----------------------------------------------------------------------------
-- growth.automation_validation_results
-- -----------------------------------------------------------------------------

create table if not exists growth.automation_validation_results (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references growth.automation_flow_versions (id) on delete cascade,
  node_id uuid references growth.automation_nodes (id) on delete cascade,
  severity text not null check (severity in ('error', 'warning', 'info')),
  rule_code text not null check (char_length(trim(rule_code)) between 1 and 80),
  message text not null check (char_length(trim(message)) between 1 and 500),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_automation_validation_results_version
  on growth.automation_validation_results (version_id, severity, created_at desc);

-- -----------------------------------------------------------------------------
-- FK back-references for current/published version pointers
-- -----------------------------------------------------------------------------

alter table growth.automation_flows
  add constraint automation_flows_current_version_fk
  foreign key (current_version_id) references growth.automation_flow_versions (id) on delete set null;

alter table growth.automation_flows
  add constraint automation_flows_published_version_fk
  foreign key (published_version_id) references growth.automation_flow_versions (id) on delete set null;

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------

drop trigger if exists set_automation_flows_updated_at on growth.automation_flows;
create trigger set_automation_flows_updated_at
  before update on growth.automation_flows
  for each row execute function public.set_updated_at();

drop trigger if exists set_automation_flow_versions_updated_at on growth.automation_flow_versions;
create trigger set_automation_flow_versions_updated_at
  before update on growth.automation_flow_versions
  for each row execute function public.set_updated_at();

drop trigger if exists set_automation_nodes_updated_at on growth.automation_nodes;
create trigger set_automation_nodes_updated_at
  before update on growth.automation_nodes
  for each row execute function public.set_updated_at();

drop trigger if exists set_automation_edges_updated_at on growth.automation_edges;
create trigger set_automation_edges_updated_at
  before update on growth.automation_edges
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.automation_flows from public, anon, authenticated;
revoke all on table growth.automation_flow_versions from public, anon, authenticated;
revoke all on table growth.automation_nodes from public, anon, authenticated;
revoke all on table growth.automation_edges from public, anon, authenticated;
revoke all on table growth.automation_validation_results from public, anon, authenticated;

grant select, insert, update, delete on growth.automation_flows to service_role;
grant select, insert, update, delete on growth.automation_flow_versions to service_role;
grant select, insert, update, delete on growth.automation_nodes to service_role;
grant select, insert, update, delete on growth.automation_edges to service_role;
grant select, insert, update, delete on growth.automation_validation_results to service_role;

alter table growth.automation_flows enable row level security;
alter table growth.automation_flows force row level security;
alter table growth.automation_flow_versions enable row level security;
alter table growth.automation_flow_versions force row level security;
alter table growth.automation_nodes enable row level security;
alter table growth.automation_nodes force row level security;
alter table growth.automation_edges enable row level security;
alter table growth.automation_edges force row level security;
alter table growth.automation_validation_results enable row level security;
alter table growth.automation_validation_results force row level security;

create policy growth_automation_flows_service_role
  on growth.automation_flows for all to service_role using (true) with check (true);

create policy growth_automation_flow_versions_service_role
  on growth.automation_flow_versions for all to service_role using (true) with check (true);

create policy growth_automation_nodes_service_role
  on growth.automation_nodes for all to service_role using (true) with check (true);

create policy growth_automation_edges_service_role
  on growth.automation_edges for all to service_role using (true) with check (true);

create policy growth_automation_validation_results_service_role
  on growth.automation_validation_results for all to service_role using (true) with check (true);
