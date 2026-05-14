-- Separate "field resource" flag from base membership role so owners/admins/managers
-- can be assigned on Schedule/Dispatch/work orders without changing access role.

alter table public.organization_members
  add column if not exists is_field_resource boolean not null default false;

comment on column public.organization_members.is_field_resource is
  'When true, member may appear in assignment pickers (Schedule, Dispatch, work orders) as assigned_user_id or via linked technician roster; independent of owner/admin/manager/tech access role.';

-- Active technicians remain schedulable after migration.
update public.organization_members
set is_field_resource = true
where role = 'tech'
  and status = 'active';

create index if not exists idx_org_members_field_resource_active
  on public.organization_members (organization_id, is_field_resource)
  where status = 'active' and is_field_resource = true;
