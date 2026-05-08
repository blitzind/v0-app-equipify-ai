-- Organization-managed technician skill tag options.
--
-- Assigned technician skills remain stored as text[] on roster/technician rows.
-- This table manages the selectable option catalog per organization.

create table if not exists public.technician_skill_tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  slug text not null check (char_length(trim(slug)) > 0),
  color text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint technician_skill_tags_color_format
    check (color is null or color ~ '^#[0-9A-Fa-f]{6}$')
);

create unique index if not exists idx_technician_skill_tags_org_slug
  on public.technician_skill_tags (organization_id, slug);

create unique index if not exists idx_technician_skill_tags_org_lower_name
  on public.technician_skill_tags (organization_id, lower(name));

create index if not exists idx_technician_skill_tags_org_active_order
  on public.technician_skill_tags (organization_id, is_active, sort_order, name);

alter table public.technician_skill_tags enable row level security;

grant select, insert, update on public.technician_skill_tags to authenticated;

drop policy if exists "technician_skill_tags_select_member" on public.technician_skill_tags;
create policy "technician_skill_tags_select_member"
on public.technician_skill_tags
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "technician_skill_tags_insert_mgr" on public.technician_skill_tags;
create policy "technician_skill_tags_insert_mgr"
on public.technician_skill_tags
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and public.has_org_role(organization_id, array['owner', 'admin', 'manager']::text[])
);

drop policy if exists "technician_skill_tags_update_mgr" on public.technician_skill_tags;
create policy "technician_skill_tags_update_mgr"
on public.technician_skill_tags
for update
to authenticated
using (
  public.is_org_member(organization_id)
  and public.has_org_role(organization_id, array['owner', 'admin', 'manager']::text[])
)
with check (
  public.is_org_member(organization_id)
  and public.has_org_role(organization_id, array['owner', 'admin', 'manager']::text[])
);

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_technician_skill_tags_updated_at on public.technician_skill_tags;
    create trigger trg_technician_skill_tags_updated_at
    before update on public.technician_skill_tags
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

with defaults(name, sort_order) as (
  values
    ('HVAC', 10),
    ('Electrical', 20),
    ('Calibration', 30),
    ('Medical Equipment', 40),
    ('Industrial Repair', 50),
    ('Installations', 60),
    ('Refrigeration', 70),
    ('Hydraulics', 80),
    ('Welding', 90),
    ('PLC / Controls', 100)
)
insert into public.technician_skill_tags (organization_id, name, slug, sort_order)
select
  o.id,
  d.name,
  lower(regexp_replace(regexp_replace(d.name, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')),
  d.sort_order
from public.organizations o
cross join defaults d
where not exists (
  select 1
  from public.technician_skill_tags existing
  where existing.organization_id = o.id
);

comment on table public.technician_skill_tags is
  'Organization-scoped selectable technician skill tag options. Assigned skills remain text[] on roster records.';
