-- Phase 31 — optional link from equipment and work orders to customer_locations (service sites).
-- Nullable FK preserves existing rows; ON DELETE SET NULL avoids blocking location archive workflows.

alter table public.equipment
  add column if not exists customer_location_id uuid references public.customer_locations (id) on delete set null;

alter table public.work_orders
  add column if not exists customer_location_id uuid references public.customer_locations (id) on delete set null;

create index if not exists idx_equipment_org_customer_location
  on public.equipment (organization_id, customer_location_id)
  where customer_location_id is not null;

create index if not exists idx_work_orders_org_customer_location
  on public.work_orders (organization_id, customer_location_id)
  where customer_location_id is not null;

comment on column public.equipment.customer_location_id is
  'Optional customer service site. When set, should correspond to equipment.customer_id. App validates; not enforced by composite FK.';

comment on column public.work_orders.customer_location_id is
  'Optional service site for dispatch and reporting; may match primary equipment site or override.';
