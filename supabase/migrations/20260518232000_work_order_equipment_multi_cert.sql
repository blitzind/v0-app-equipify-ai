-- Multi-equipment work orders + per-equipment calibration records.
-- Backfills join rows from work_orders.equipment_id and sets calibration_records.equipment_id.

-- ─── work_order_equipment (many assets per work order) ──────────────────────

create table if not exists public.work_order_equipment (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  equipment_id uuid not null,
  created_at timestamptz not null default now(),
  constraint work_order_equipment_equipment_fkey
    foreign key (organization_id, equipment_id)
    references public.equipment (organization_id, id)
    on delete cascade,
  constraint work_order_equipment_unique_asset unique (work_order_id, equipment_id)
);

create index if not exists idx_work_order_equipment_org_wo
  on public.work_order_equipment (organization_id, work_order_id);

comment on table public.work_order_equipment is
  'Assets included on a work order. When empty in app, legacy work_orders.equipment_id is the single asset.';

-- Align organization_id with parent work order (defense in depth)
create or replace function public.work_order_equipment_sync_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wo_org uuid;
begin
  select organization_id into wo_org from public.work_orders where id = new.work_order_id;
  if wo_org is null then
    raise exception 'work_order not found';
  end if;
  if new.organization_id is distinct from wo_org then
    new.organization_id := wo_org;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_work_order_equipment_sync_org on public.work_order_equipment;
create trigger trg_work_order_equipment_sync_org
before insert or update on public.work_order_equipment
for each row execute function public.work_order_equipment_sync_org();

create or replace function public.work_order_equipment_validate_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wo_customer uuid;
  eq_customer uuid;
begin
  select customer_id into wo_customer
  from public.work_orders
  where id = new.work_order_id and organization_id = new.organization_id;

  select customer_id into eq_customer
  from public.equipment
  where id = new.equipment_id and organization_id = new.organization_id;

  if wo_customer is null then
    raise exception 'work order not found for organization';
  end if;
  if eq_customer is null then
    raise exception 'equipment not found for organization';
  end if;
  if wo_customer <> eq_customer then
    raise exception 'work_order_equipment: equipment must belong to the same customer as the work order';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_work_order_equipment_validate_customer on public.work_order_equipment;
create trigger trg_work_order_equipment_validate_customer
before insert or update on public.work_order_equipment
for each row execute function public.work_order_equipment_validate_customer();

insert into public.work_order_equipment (organization_id, work_order_id, equipment_id)
select wo.organization_id, wo.id, wo.equipment_id
from public.work_orders wo
where not exists (
  select 1
  from public.work_order_equipment woe
  where woe.work_order_id = wo.id
    and woe.equipment_id = wo.equipment_id
);

revoke all on table public.work_order_equipment from public, anon;
grant select, insert, update, delete on table public.work_order_equipment to authenticated;

alter table public.work_order_equipment enable row level security;
alter table public.work_order_equipment force row level security;

drop policy if exists "work_order_equipment_select_member" on public.work_order_equipment;
create policy "work_order_equipment_select_member"
on public.work_order_equipment
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "work_order_equipment_write_roles" on public.work_order_equipment;
create policy "work_order_equipment_write_roles"
on public.work_order_equipment
for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

-- ─── calibration_records.equipment_id ────────────────────────────────────────

alter table public.calibration_records
  add column if not exists equipment_id uuid;

update public.calibration_records cr
set equipment_id = wo.equipment_id
from public.work_orders wo
where cr.work_order_id = wo.id
  and cr.organization_id = wo.organization_id
  and cr.equipment_id is null;

alter table public.calibration_records
  alter column equipment_id set not null;

alter table public.calibration_records
  drop constraint if exists calibration_records_equipment_org_fkey;

alter table public.calibration_records
  add constraint calibration_records_equipment_org_fkey
  foreign key (organization_id, equipment_id)
  references public.equipment (organization_id, id)
  on delete restrict;

create index if not exists idx_calibration_records_org_wo_equipment_created
  on public.calibration_records (organization_id, work_order_id, equipment_id, created_at desc);

comment on column public.calibration_records.equipment_id is
  'Equipment asset this certificate applies to; unique logical scope per work order + asset is enforced in application (latest row wins).';
