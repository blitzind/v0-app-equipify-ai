-- Per-asset job metadata on work_order_equipment (type, priority, optional notes).
-- Legacy rows keep null work_type/priority; UI may inherit work_orders.type / priority.

alter table public.work_order_equipment
  add column if not exists work_type text
    check (
      work_type is null
      or work_type in ('repair', 'pm', 'inspection', 'install', 'emergency')
    ),
  add column if not exists priority text
    check (
      priority is null
      or priority in ('low', 'normal', 'high', 'critical')
    ),
  add column if not exists problem_reported text,
  add column if not exists notes text;

comment on column public.work_order_equipment.work_type is
  'Per-asset type (same domain as work_orders.type); null = legacy / inherit parent in UI.';
comment on column public.work_order_equipment.priority is
  'Per-asset priority; null = legacy / inherit parent in UI.';
comment on column public.work_order_equipment.problem_reported is
  'Optional per-asset problem text; work_orders.problem_reported remains the canonical WO-level field.';
comment on column public.work_order_equipment.notes is
  'Optional per-asset notes for this job line.';
