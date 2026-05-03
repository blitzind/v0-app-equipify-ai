-- Idempotent repair: assign monotonic numbers to any row still missing work_order_number,
-- then enforce NOT NULL. No deletes; UUID primary key unchanged.

update public.work_orders wo
set work_order_number = base.mx + null_rows.rn
from (
  select
    id,
    organization_id,
    row_number() over (
      partition by organization_id
      order by created_at asc, id asc
    ) as rn
  from public.work_orders
  where work_order_number is null
) null_rows
join (
  select organization_id, coalesce(max(work_order_number), 0) as mx
  from public.work_orders
  group by organization_id
) base on base.organization_id = null_rows.organization_id
where wo.id = null_rows.id;

alter table public.work_orders
  alter column work_order_number set not null;
