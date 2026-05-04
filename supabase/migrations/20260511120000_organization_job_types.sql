-- Organization-scoped job type labels for scheduling (seed defaults + admin-created rows).

do $$
begin
  if to_regprocedure('public.is_org_member(uuid)') is null then
    raise exception 'Missing dependency: function public.is_org_member(uuid) must exist.';
  end if;

  if to_regprocedure('public.has_org_role(uuid,text[])') is null then
    raise exception 'Missing dependency: function public.has_org_role(uuid,text[]) must exist.';
  end if;

  if to_regprocedure('public.prevent_organization_id_change()') is null then
    raise exception 'Missing dependency: function public.prevent_organization_id_change() must exist.';
  end if;
end;
$$;

create table if not exists public.organization_job_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  work_order_type text not null
    check (work_order_type in ('repair', 'pm', 'inspection', 'install', 'emergency')),
  is_seed boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index if not exists idx_organization_job_types_org_sort
  on public.organization_job_types (organization_id, sort_order, name);

drop trigger if exists trg_organization_job_types_immutable_org on public.organization_job_types;
create trigger trg_organization_job_types_immutable_org
before update on public.organization_job_types
for each row execute function public.prevent_organization_id_change();

-- Seed defaults for new organizations
create or replace function public.seed_organization_job_types_for_org()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.organization_job_types (organization_id, name, work_order_type, is_seed, sort_order)
  values
    (new.id, 'Preventive Maintenance', 'pm', true, 10),
    (new.id, 'Emergency Repair', 'emergency', true, 20),
    (new.id, 'Calibration', 'inspection', true, 30),
    (new.id, 'Inspection', 'inspection', true, 40),
    (new.id, 'Installation', 'install', true, 50),
    (new.id, 'Warranty Service', 'repair', true, 60),
    (new.id, 'Quote Visit', 'repair', true, 70)
  on conflict (organization_id, name) do nothing;
  return new;
end;
$$;

revoke all on function public.seed_organization_job_types_for_org() from public, anon, authenticated;
alter function public.seed_organization_job_types_for_org() owner to postgres;

drop trigger if exists trg_organizations_seed_job_types on public.organizations;
create trigger trg_organizations_seed_job_types
after insert on public.organizations
for each row execute function public.seed_organization_job_types_for_org();

-- Backfill existing organizations
insert into public.organization_job_types (organization_id, name, work_order_type, is_seed, sort_order)
select o.id, v.name, v.wot, true, v.ord
from public.organizations o
cross join (
  values
    ('Preventive Maintenance'::text, 'pm'::text, 10),
    ('Emergency Repair', 'emergency', 20),
    ('Calibration', 'inspection', 30),
    ('Inspection', 'inspection', 40),
    ('Installation', 'install', 50),
    ('Warranty Service', 'repair', 60),
    ('Quote Visit', 'repair', 70)
) as v(name, wot, ord)
on conflict (organization_id, name) do nothing;

revoke all on table public.organization_job_types from public, anon;
grant select, insert, update, delete on table public.organization_job_types to authenticated;

alter table public.organization_job_types enable row level security;

drop policy if exists "organization_job_types_select_member" on public.organization_job_types;
create policy "organization_job_types_select_member"
on public.organization_job_types
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "organization_job_types_insert_admin" on public.organization_job_types;
create policy "organization_job_types_insert_admin"
on public.organization_job_types
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);

drop policy if exists "organization_job_types_update_admin" on public.organization_job_types;
create policy "organization_job_types_update_admin"
on public.organization_job_types
for update
to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
)
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);

drop policy if exists "organization_job_types_delete_admin" on public.organization_job_types;
create policy "organization_job_types_delete_admin"
on public.organization_job_types
for delete
to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);
