-- Warranty-aware billing flags on work orders.

alter table public.work_orders
  add column if not exists billable_to_customer boolean not null default true,
  add column if not exists warranty_review_required boolean not null default false,
  add column if not exists warranty_vendor_id uuid references public.org_vendors (id) on delete set null;

create index if not exists idx_work_orders_org_warranty_vendor
  on public.work_orders (organization_id, warranty_vendor_id)
  where warranty_vendor_id is not null;

comment on column public.work_orders.billable_to_customer is
  'When true, invoice should bill customer directly. When false, billing is warranty/vendor-side.';

comment on column public.work_orders.warranty_review_required is
  'Set true when linked asset appears under active warranty and billing needs explicit review.';

comment on column public.work_orders.warranty_vendor_id is
  'Optional vendor to bill for warranty claims.';

create or replace function public.work_orders_apply_warranty_review_default()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  eq_start date;
  eq_exp date;
  active_warranty boolean := false;
begin
  if new.equipment_id is null then
    return new;
  end if;

  select e.warranty_start_date,
         coalesce(e.warranty_expiration_date, e.warranty_expires_at)
    into eq_start, eq_exp
  from public.equipment e
  where e.id = new.equipment_id
    and e.organization_id = new.organization_id
    and e.is_archived = false
  limit 1;

  if eq_exp is not null
     and eq_exp >= current_date
     and (eq_start is null or eq_start <= current_date) then
    active_warranty := true;
  end if;

  if active_warranty then
    new.warranty_review_required := true;
  elsif tg_op = 'INSERT' and new.warranty_review_required is null then
    new.warranty_review_required := false;
  end if;

  if tg_op = 'INSERT' and new.billable_to_customer is null then
    new.billable_to_customer := true;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_work_orders_warranty_review_default on public.work_orders;
create trigger trg_work_orders_warranty_review_default
before insert or update of equipment_id, organization_id
on public.work_orders
for each row execute function public.work_orders_apply_warranty_review_default();
