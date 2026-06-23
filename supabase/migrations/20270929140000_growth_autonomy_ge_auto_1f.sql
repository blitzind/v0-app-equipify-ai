-- GE-AUTO-1F — Objective planner persistence.
-- Creates growth.organization_growth_objectives for objective-driven orchestration.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
end;
$$;

create table if not exists growth.organization_growth_objectives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  description text,
  objective_type text not null default 'custom' check (
    objective_type in (
      'demos_booked',
      'meetings_booked',
      'opportunities_created',
      'pipeline_value',
      'customers_acquired',
      'custom'
    )
  ),
  target_value numeric not null default 0,
  current_value numeric not null default 0,
  start_date timestamptz,
  target_date timestamptz,
  status text not null default 'draft' check (
    status in ('draft', 'planning', 'active', 'paused', 'completed', 'archived')
  ),
  owner_user_id uuid,
  priority text not null default 'medium' check (
    priority in ('low', 'medium', 'high', 'critical')
  ),
  autonomy_level text not null default 'objective' check (
    autonomy_level in ('manual', 'assisted', 'guardrailed', 'channel', 'objective')
  ),
  safety_mode text not null default 'strict' check (
    safety_mode in ('strict', 'balanced', 'shadow')
  ),
  plan jsonb not null default '{}'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  emergency_stop_active boolean not null default false,
  qa_marker text not null default 'growth-autonomy-ge-auto-1f-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_organization_growth_objectives_org
  on growth.organization_growth_objectives (organization_id);

create index if not exists idx_growth_organization_growth_objectives_status
  on growth.organization_growth_objectives (organization_id, status);

comment on table growth.organization_growth_objectives is
  'GE-AUTO-1F org growth objectives — planner output stored in plan JSONB; no autonomous approvals.';

drop trigger if exists trg_growth_organization_growth_objectives_set_updated_at
  on growth.organization_growth_objectives;
create trigger trg_growth_organization_growth_objectives_set_updated_at
before update on growth.organization_growth_objectives
for each row execute function public.set_updated_at();

revoke all on table growth.organization_growth_objectives from public, anon, authenticated;
grant select, insert, update, delete on table growth.organization_growth_objectives to service_role;

alter table growth.organization_growth_objectives enable row level security;
alter table growth.organization_growth_objectives force row level security;

drop policy if exists growth_organization_growth_objectives_service_role
  on growth.organization_growth_objectives;
create policy growth_organization_growth_objectives_service_role
  on growth.organization_growth_objectives for all to service_role using (true) with check (true);
