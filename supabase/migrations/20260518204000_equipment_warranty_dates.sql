-- Real warranty tracking fields for equipment drawer/tab editing.

alter table public.equipment
  add column if not exists warranty_start_date date,
  add column if not exists warranty_expiration_date date;

comment on column public.equipment.warranty_start_date is
  'Warranty coverage start date.';

comment on column public.equipment.warranty_expiration_date is
  'Warranty coverage expiration date used for active/warning/expired status.';

-- Backfill from legacy columns when empty.
update public.equipment e
set
  warranty_start_date = coalesce(e.warranty_start_date, e.install_date),
  warranty_expiration_date = coalesce(e.warranty_expiration_date, e.warranty_expires_at)
where e.warranty_start_date is null
   or e.warranty_expiration_date is null;
