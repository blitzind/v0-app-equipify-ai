-- Branded work order numbers per organization (display: WO- + 7 zero-padded digits).
-- UUID remains the primary key; routing and FKs unchanged.

alter table public.work_orders
  add column if not exists work_order_number integer;

update public.work_orders wo
set work_order_number = sub.rn
from (
  select
    id,
    row_number() over (
      partition by organization_id
      order by created_at asc, id asc
    ) as rn
  from public.work_orders
  where work_order_number is null
) sub
where wo.id = sub.id;

alter table public.work_orders
  alter column work_order_number set not null;

create unique index if not exists idx_work_orders_org_work_order_number_unique
  on public.work_orders (organization_id, work_order_number);

create or replace function public.work_orders_assign_number()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  next_n integer;
begin
  if new.work_order_number is not null then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext(new.organization_id::text));
  select coalesce(max(work_order_number), 0) + 1 into next_n
  from public.work_orders
  where organization_id = new.organization_id;
  new.work_order_number := next_n;
  return new;
end;
$$;

alter function public.work_orders_assign_number() owner to postgres;

drop trigger if exists trg_work_orders_assign_number on public.work_orders;
create trigger trg_work_orders_assign_number
  before insert on public.work_orders
  for each row
  execute function public.work_orders_assign_number();

comment on column public.work_orders.work_order_number is
  'Monotonic per organization. App displays as WO- + 7-digit zero-padded string.';
