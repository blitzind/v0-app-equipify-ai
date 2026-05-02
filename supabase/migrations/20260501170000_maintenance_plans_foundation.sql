-- Maintenance plans foundation (tenant-scoped)
-- Creates public.maintenance_plans with composite FKs to customers and equipment,
-- optional assigned_user_id (active org member), JSONB for services and notification rules,
-- archive semantics, RLS, and optional link column on work_orders.
--
-- Inserts from the normal dashboard/API are expected to run as role authenticated
-- (Supabase JWT). Column created_by defaults to auth.uid() and trigger set_maintenance_plans_created_by
-- overwrites created_by with auth.uid() on INSERT so audit attribution matches the signed-in user.
-- Service-role or background jobs inserting without a JWT must set session claims or use a dedicated path;
-- otherwise created_by will be null and the insert will fail by design.
--
-- Application mapping (normalize in app layer):
--   status: Active -> active | Paused -> paused | Expired -> expired
--   priority: same as work_orders (low | normal | high | critical)
--   interval_unit: day | week | month | year (interval_value > 0)

do $$
begin
  if to_regclass('public.customers') is null then
    raise exception 'Missing dependency: table public.customers must exist before this migration.';
  end if;

  if to_regclass('public.equipment') is null then
    raise exception 'Missing dependency: table public.equipment must exist before this migration.';
  end if;

  if to_regclass('public.work_orders') is null then
    raise exception 'Missing dependency: table public.work_orders must exist before this migration.';
  end if;

  if to_regprocedure('public.is_org_member(uuid)') is null then
    raise exception 'Missing dependency: function public.is_org_member(uuid) must exist before this migration.';
  end if;

  if to_regprocedure('public.has_org_role(uuid,text[])') is null then
    raise exception 'Missing dependency: function public.has_org_role(uuid,text[]) must exist before this migration.';
  end if;
end;
$$;

create unique index if not exists idx_equipment_org_id_composite
  on public.equipment (organization_id, id);

create table if not exists public.maintenance_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  customer_id uuid not null,
  equipment_id uuid not null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(trim(name)) > 0),
  status text not null default 'active'
    check (status in ('active', 'paused', 'expired')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'critical')),
  interval_value integer not null check (interval_value > 0),
  interval_unit text not null
    check (interval_unit in ('day', 'week', 'month', 'year')),
  last_service_date date,
  next_due_date date,
  auto_create_work_order boolean not null default false,
  notes text,
  services jsonb not null default '[]'::jsonb,
  notification_rules jsonb not null default '[]'::jsonb,
  constraint maintenance_plans_services_jsonb_shape
    check (
      jsonb_typeof(services) = 'array'
      and octet_length(services::text) <= 524288
    ),
  constraint maintenance_plans_notification_rules_jsonb_shape
    check (
      jsonb_typeof(notification_rules) = 'array'
      and octet_length(notification_rules::text) <= 524288
    ),
  is_archived boolean not null default false,
  archived_at timestamptz,
  -- See file header: typical client inserts use authenticated + auth.uid(); see trigger set_maintenance_plans_created_by.
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_plans_archived_consistency
    check (
      (is_archived = true and archived_at is not null) or
      (is_archived = false and archived_at is null)
    ),
  constraint maintenance_plans_customer_org_fkey
    foreign key (organization_id, customer_id)
    references public.customers (organization_id, id)
    on delete restrict,
  constraint maintenance_plans_equipment_org_fkey
    foreign key (organization_id, equipment_id)
    references public.equipment (organization_id, id)
    on delete restrict
);

comment on table public.maintenance_plans is
  'Preventive maintenance agreements per equipment; tenant-scoped; services and notification_rules stored as JSONB.';

comment on column public.maintenance_plans.status is
  'active | paused | expired';

comment on column public.maintenance_plans.priority is
  'low | normal | high | critical';

comment on column public.maintenance_plans.services is
  'JSON array of service line items (shape defined by application). Must remain a JSON array; max ~512 KiB serialized text per constraint.';

comment on column public.maintenance_plans.notification_rules is
  'JSON array of reminder rules (shape defined by application). Must remain a JSON array; max ~512 KiB serialized text per constraint.';

-- Indexes
create index if not exists idx_maintenance_plans_org_archived_status
  on public.maintenance_plans (organization_id, is_archived, status);

create index if not exists idx_maintenance_plans_org_next_due
  on public.maintenance_plans (organization_id, next_due_date)
  where is_archived = false and next_due_date is not null;

create index if not exists idx_maintenance_plans_org_customer
  on public.maintenance_plans (organization_id, customer_id);

create index if not exists idx_maintenance_plans_org_equipment
  on public.maintenance_plans (organization_id, equipment_id);

create index if not exists idx_maintenance_plans_org_assigned_user
  on public.maintenance_plans (organization_id, assigned_user_id)
  where assigned_user_id is not null;

create index if not exists idx_maintenance_plans_org_created_at
  on public.maintenance_plans (organization_id, created_at desc);

-- updated_at trigger (reuse public.set_updated_at if present)
do $$
begin
  if to_regprocedure('public.set_updated_at()') is null then
    create function public.set_updated_at()
    returns trigger
    language plpgsql
    security definer
    set search_path = public, pg_catalog
    as $fn$
    begin
      new.updated_at := now();
      return new;
    end;
    $fn$;

    revoke all on function public.set_updated_at() from public, anon, authenticated;
    alter function public.set_updated_at() owner to postgres;
  end if;
end;
$$;

drop trigger if exists trg_maintenance_plans_set_updated_at on public.maintenance_plans;
create trigger trg_maintenance_plans_set_updated_at
before update on public.maintenance_plans
for each row execute function public.set_updated_at();

-- Equipment row must belong to maintenance_plans.customer_id for this organization
create or replace function public.maintenance_plans_validate_customer_equipment_pair()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  equip_customer_id uuid;
begin
  select e.customer_id into equip_customer_id
  from public.equipment e
  where e.organization_id = new.organization_id
    and e.id = new.equipment_id;

  if equip_customer_id is null then
    raise exception 'equipment not found for this organization_id and equipment_id (cannot validate customer linkage)';
  end if;

  if equip_customer_id is distinct from new.customer_id then
    raise exception 'maintenance_plans.customer_id must match equipment.customer_id for this organization';
  end if;

  return new;
end;
$$;

revoke all on function public.maintenance_plans_validate_customer_equipment_pair() from public, anon, authenticated;
alter function public.maintenance_plans_validate_customer_equipment_pair() owner to postgres;

drop trigger if exists trg_maintenance_plans_validate_customer_equipment_pair on public.maintenance_plans;
create trigger trg_maintenance_plans_validate_customer_equipment_pair
before insert or update on public.maintenance_plans
for each row execute function public.maintenance_plans_validate_customer_equipment_pair();

-- assigned_user_id must be an active organization member when set
create or replace function public.maintenance_plans_validate_assigned_member()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.assigned_user_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = new.organization_id
      and om.user_id = new.assigned_user_id
      and om.status = 'active'
  ) then
    raise exception 'assigned_user_id must be an active member of the organization';
  end if;

  return new;
end;
$$;

revoke all on function public.maintenance_plans_validate_assigned_member() from public, anon, authenticated;
alter function public.maintenance_plans_validate_assigned_member() owner to postgres;

drop trigger if exists trg_maintenance_plans_validate_assigned_member on public.maintenance_plans;
create trigger trg_maintenance_plans_validate_assigned_member
before insert or update on public.maintenance_plans
for each row execute function public.maintenance_plans_validate_assigned_member();

-- Immutable organization_id, customer_id, equipment_id after insert
create or replace function public.prevent_maintenance_plans_identity_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id is immutable once created';
  end if;
  if new.customer_id is distinct from old.customer_id then
    raise exception 'customer_id is immutable once created';
  end if;
  if new.equipment_id is distinct from old.equipment_id then
    raise exception 'equipment_id is immutable once created';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_maintenance_plans_identity_change() from public, anon, authenticated;
alter function public.prevent_maintenance_plans_identity_change() owner to postgres;

drop trigger if exists trg_maintenance_plans_immutable_identity on public.maintenance_plans;
create trigger trg_maintenance_plans_immutable_identity
before update on public.maintenance_plans
for each row execute function public.prevent_maintenance_plans_identity_change();

-- Prevent created_by spoofing; enforce auth.uid() on insert; block updates.
-- Intended for inserts as authenticated end users (JWT); see column comment and file header.
create or replace function public.set_maintenance_plans_created_by()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    if new.created_by is null then
      raise exception 'created_by cannot be set without an authenticated user';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.created_by is distinct from old.created_by then
      raise exception 'created_by is immutable once created';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.set_maintenance_plans_created_by() from public, anon, authenticated;
alter function public.set_maintenance_plans_created_by() owner to postgres;

drop trigger if exists trg_maintenance_plans_set_created_by on public.maintenance_plans;
create trigger trg_maintenance_plans_set_created_by
before insert or update on public.maintenance_plans
for each row execute function public.set_maintenance_plans_created_by();

-- Privileges (soft-archive model: no delete grant)
revoke all on table public.maintenance_plans from public, anon;
grant select, insert, update on table public.maintenance_plans to authenticated;

-- RLS
alter table public.maintenance_plans enable row level security;
alter table public.maintenance_plans force row level security;

drop policy if exists "maintenance_plans_select_member" on public.maintenance_plans;
create policy "maintenance_plans_select_member"
on public.maintenance_plans
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "maintenance_plans_insert_owner_admin_manager" on public.maintenance_plans;
create policy "maintenance_plans_insert_owner_admin_manager"
on public.maintenance_plans
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);

drop policy if exists "maintenance_plans_update_owner_admin_manager" on public.maintenance_plans;
create policy "maintenance_plans_update_owner_admin_manager"
on public.maintenance_plans
for update
to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
)
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);

-- ---------------------------------------------------------------------------
-- Optional link from work_orders to maintenance_plans (same organization)
-- ---------------------------------------------------------------------------

alter table public.work_orders
  add column if not exists maintenance_plan_id uuid references public.maintenance_plans(id) on delete set null;

comment on column public.work_orders.maintenance_plan_id is
  'Optional FK when this work order was created from or tied to a maintenance plan. Trigger enforces same organization, customer, and equipment as the plan.';

create index if not exists idx_work_orders_org_maintenance_plan
  on public.work_orders (organization_id, maintenance_plan_id)
  where maintenance_plan_id is not null;

create or replace function public.work_orders_validate_maintenance_plan_org()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  plan_org uuid;
  plan_customer_id uuid;
  plan_equipment_id uuid;
begin
  if new.maintenance_plan_id is null then
    return new;
  end if;

  select mp.organization_id, mp.customer_id, mp.equipment_id
  into plan_org, plan_customer_id, plan_equipment_id
  from public.maintenance_plans mp
  where mp.id = new.maintenance_plan_id;

  if plan_org is null then
    raise exception 'maintenance_plan_id references an unknown maintenance plan';
  end if;

  if plan_org is distinct from new.organization_id then
    raise exception 'maintenance_plan_id must reference a plan in the same organization as the work order';
  end if;

  if plan_customer_id is distinct from new.customer_id then
    raise exception 'maintenance_plan_id must reference a plan whose customer_id matches the work order customer_id';
  end if;

  if plan_equipment_id is distinct from new.equipment_id then
    raise exception 'maintenance_plan_id must reference a plan whose equipment_id matches the work order equipment_id';
  end if;

  return new;
end;
$$;

revoke all on function public.work_orders_validate_maintenance_plan_org() from public, anon, authenticated;
alter function public.work_orders_validate_maintenance_plan_org() owner to postgres;

drop trigger if exists trg_work_orders_validate_maintenance_plan_org on public.work_orders;
create trigger trg_work_orders_validate_maintenance_plan_org
before insert or update on public.work_orders
for each row execute function public.work_orders_validate_maintenance_plan_org();
