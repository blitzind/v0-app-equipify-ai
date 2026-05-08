-- Mobile quick appointment creation — allow service visits before equipment is known.
--
-- Work orders remain the scheduled service entity. This relaxes the legacy
-- requirement that every work order has a primary equipment row so dispatchers
-- can create customer/site visits quickly and attach equipment later.

alter table public.work_orders
  alter column equipment_id drop not null;

comment on column public.work_orders.equipment_id is
  'Optional primary equipment asset. Null is allowed for quick service visits where equipment is not yet known.';
