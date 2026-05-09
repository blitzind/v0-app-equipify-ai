-- Regression audit Phases 17-19:
-- Phase 21 introduced restricted technician workflows, but the older
-- certificate/storage RLS still allowed only owner/admin/manager writes.
-- Keep manager access unchanged and allow tech writes only on assigned work
-- orders so certificate saves and certificate uploads match the UI contract.

create or replace function public.can_write_assigned_work_order_artifact(
  p_organization_id uuid,
  p_work_order_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select
    public.has_org_role(p_organization_id, array['owner', 'admin', 'manager']::text[])
    or (
      public.has_org_role(p_organization_id, array['tech']::text[])
      and exists (
        select 1
        from public.work_orders wo
        left join public.technicians t
          on t.organization_id = wo.organization_id
         and t.id = wo.assigned_technician_id
        left join public.organization_members om
          on om.organization_id = t.organization_id
         and om.membership_id = t.membership_id
        where wo.organization_id = p_organization_id
          and wo.id = p_work_order_id
          and (
            wo.assigned_user_id = auth.uid()
            or om.user_id = auth.uid()
          )
      )
    );
$$;

revoke all on function public.can_write_assigned_work_order_artifact(uuid, uuid) from public;
grant execute on function public.can_write_assigned_work_order_artifact(uuid, uuid) to authenticated;

drop policy if exists "calibration_records_insert_roles_billing" on public.calibration_records;
create policy "calibration_records_insert_roles_billing"
on public.calibration_records
for insert
to authenticated
with check (
  public.can_write_assigned_work_order_artifact(organization_id, work_order_id)
  and public.can_org_create_records(organization_id)
);

drop policy if exists "calibration_records_update_roles" on public.calibration_records;
create policy "calibration_records_update_roles"
on public.calibration_records
for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "calibration_records_delete_roles" on public.calibration_records;
create policy "calibration_records_delete_roles"
on public.calibration_records
for delete
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "certificate_attachments_write_roles" on public.certificate_attachments;
create policy "certificate_attachments_write_roles"
on public.certificate_attachments
for all
to authenticated
using (public.can_write_assigned_work_order_artifact(organization_id, work_order_id))
with check (public.can_write_assigned_work_order_artifact(organization_id, work_order_id));

drop policy if exists "wo_attachments_insert_roles" on storage.objects;
create policy "wo_attachments_insert_roles"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'work-order-attachments'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  and split_part(name, '/', 2) ~ '^[0-9a-fA-F-]{36}$'
  and public.can_write_assigned_work_order_artifact(
    split_part(name, '/', 1)::uuid,
    split_part(name, '/', 2)::uuid
  )
);

drop policy if exists "wo_attachments_update_roles" on storage.objects;
create policy "wo_attachments_update_roles"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'work-order-attachments'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  and split_part(name, '/', 2) ~ '^[0-9a-fA-F-]{36}$'
  and public.can_write_assigned_work_order_artifact(
    split_part(name, '/', 1)::uuid,
    split_part(name, '/', 2)::uuid
  )
)
with check (
  bucket_id = 'work-order-attachments'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  and split_part(name, '/', 2) ~ '^[0-9a-fA-F-]{36}$'
  and public.can_write_assigned_work_order_artifact(
    split_part(name, '/', 1)::uuid,
    split_part(name, '/', 2)::uuid
  )
);

drop policy if exists "wo_attachments_delete_roles" on storage.objects;
create policy "wo_attachments_delete_roles"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'work-order-attachments'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  and split_part(name, '/', 2) ~ '^[0-9a-fA-F-]{36}$'
  and public.can_write_assigned_work_order_artifact(
    split_part(name, '/', 1)::uuid,
    split_part(name, '/', 2)::uuid
  )
);
