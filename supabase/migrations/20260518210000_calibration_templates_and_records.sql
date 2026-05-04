-- Calibration templates and per-work-order certificate records (MVP).

create table if not exists public.calibration_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  equipment_category_id text,
  fields jsonb not null default '[]'::jsonb,
  is_archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calibration_templates_archive_consistency check (
    (is_archived = true and archived_at is not null) or
    (is_archived = false and archived_at is null)
  )
);

create index if not exists idx_calibration_templates_org_name
  on public.calibration_templates (organization_id, name);

create index if not exists idx_calibration_templates_org_category
  on public.calibration_templates (organization_id, equipment_category_id);

create table if not exists public.calibration_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  template_id uuid not null references public.calibration_templates (id) on delete restrict,
  values jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_calibration_records_org_work_order_created
  on public.calibration_records (organization_id, work_order_id, created_at desc);

create index if not exists idx_calibration_records_org_template
  on public.calibration_records (organization_id, template_id);

alter table public.work_orders
  add column if not exists calibration_template_id uuid references public.calibration_templates (id) on delete set null;

create index if not exists idx_work_orders_org_calibration_template
  on public.work_orders (organization_id, calibration_template_id);

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_calibration_templates_set_updated_at on public.calibration_templates;
    create trigger trg_calibration_templates_set_updated_at
    before update on public.calibration_templates
    for each row execute function public.set_updated_at();
  end if;
end
$$;

revoke all on table public.calibration_templates from public, anon;
grant select, insert, update, delete on table public.calibration_templates to authenticated;

revoke all on table public.calibration_records from public, anon;
grant select, insert, update, delete on table public.calibration_records to authenticated;

alter table public.calibration_templates enable row level security;
alter table public.calibration_records enable row level security;

drop policy if exists "calibration_templates_select_member" on public.calibration_templates;
create policy "calibration_templates_select_member"
on public.calibration_templates
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "calibration_templates_write_roles" on public.calibration_templates;
create policy "calibration_templates_write_roles"
on public.calibration_templates
for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "calibration_records_select_member" on public.calibration_records;
create policy "calibration_records_select_member"
on public.calibration_records
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "calibration_records_write_roles" on public.calibration_records;
create policy "calibration_records_write_roles"
on public.calibration_records
for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));
