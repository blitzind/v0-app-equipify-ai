-- Allow maintenance plans without equipment (attach later). Automation and work orders
-- still require equipment where enforced in application logic.

alter table public.maintenance_plans
  alter column equipment_id drop not null;

comment on column public.maintenance_plans.equipment_id is
  'Optional equipment scope; NULL until attached. Auto-created work orders skip plans with NULL equipment_id.';

-- Skip validation when no equipment row is referenced yet.
create or replace function public.maintenance_plans_validate_customer_equipment_pair()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  equip_customer_id uuid;
begin
  if new.equipment_id is null then
    return new;
  end if;

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

-- Allow first-time attach: NULL -> UUID. Forbid changing equipment once set.
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
  if old.equipment_id is not null and new.equipment_id is distinct from old.equipment_id then
    raise exception 'equipment_id cannot be changed once set';
  end if;
  return new;
end;
$$;
