-- Phase 1: Equipment intelligence — taxonomy, compliance placeholders, reporting indexes.
-- Non-destructive: additive columns only; preserves RLS and organization_id patterns.

alter table public.equipment
  add column if not exists subcategory text,
  add column if not exists calibration_interval_months integer,
  add column if not exists next_calibration_due_at date;

comment on column public.equipment.subcategory is
  'Optional sub-type under category for hierarchical filtering/reporting (phase 1 stores flat strings; future: FK to taxonomy table).';

comment on column public.equipment.calibration_interval_months is
  'Planned calibration/compliance interval in months; drives reminders when populated.';

comment on column public.equipment.next_calibration_due_at is
  'Next calibration or compliance due date (manual or computed from last certificate + interval).';

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'equipment' and c.conname = 'equipment_calibration_interval_positive'
  ) then
    alter table public.equipment
      add constraint equipment_calibration_interval_positive
      check (calibration_interval_months is null or calibration_interval_months > 0);
  end if;
end $$;

create index if not exists idx_equipment_org_category_subcategory
  on public.equipment (organization_id, category, subcategory)
  where archived_at is null;

create index if not exists idx_equipment_org_next_calibration
  on public.equipment (organization_id, next_calibration_due_at)
  where archived_at is null and next_calibration_due_at is not null;

create index if not exists idx_equipment_org_manufacturer
  on public.equipment (organization_id, manufacturer)
  where archived_at is null and manufacturer is not null and trim(manufacturer) <> '';
