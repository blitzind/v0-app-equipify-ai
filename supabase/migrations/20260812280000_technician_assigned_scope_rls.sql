-- Phase 21C: direct-client RLS hardening for technician assigned-work scope.
--
-- This migration intentionally keeps the existing owner/admin/manager behavior
-- broad, preserves non-tech member read behavior, and narrows only DB-role
-- `tech` users when they bypass the app/API and query Supabase directly.

create or replace function public.can_read_work_order_for_role(
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
    public.is_org_member(p_organization_id)
    and (
      not public.has_org_role(p_organization_id, array['tech'])
      or exists (
        select 1
        from public.work_orders wo
        left join public.technicians t
          on t.organization_id = wo.organization_id
         and t.id = wo.assigned_technician_id
        left join public.organization_members om
          on om.organization_id = t.organization_id
         and om.membership_id = t.membership_id
         and om.status = 'active'
        where wo.organization_id = p_organization_id
          and wo.id = p_work_order_id
          and wo.archived_at is null
          and (
            wo.assigned_user_id = auth.uid()
            or om.user_id = auth.uid()
          )
      )
    );
$$;

revoke all on function public.can_read_work_order_for_role(uuid, uuid) from public;
grant execute on function public.can_read_work_order_for_role(uuid, uuid) to authenticated;

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
         and om.status = 'active'
        where wo.organization_id = p_organization_id
          and wo.id = p_work_order_id
          and wo.archived_at is null
          and (
            wo.assigned_user_id = auth.uid()
            or om.user_id = auth.uid()
          )
      )
    );
$$;

revoke all on function public.can_write_assigned_work_order_artifact(uuid, uuid) from public;
grant execute on function public.can_write_assigned_work_order_artifact(uuid, uuid) to authenticated;

create or replace function public.can_read_customer_for_role(
  p_organization_id uuid,
  p_customer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select
    public.is_org_member(p_organization_id)
    and (
      not public.has_org_role(p_organization_id, array['tech'])
      or exists (
        select 1
        from public.work_orders wo
        where wo.organization_id = p_organization_id
          and wo.customer_id = p_customer_id
          and public.can_read_work_order_for_role(wo.organization_id, wo.id)
      )
    );
$$;

revoke all on function public.can_read_customer_for_role(uuid, uuid) from public;
grant execute on function public.can_read_customer_for_role(uuid, uuid) to authenticated;

create or replace function public.can_read_equipment_for_role(
  p_organization_id uuid,
  p_equipment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select
    public.is_org_member(p_organization_id)
    and (
      not public.has_org_role(p_organization_id, array['tech'])
      or exists (
        select 1
        from public.work_orders wo
        where wo.organization_id = p_organization_id
          and wo.equipment_id = p_equipment_id
          and public.can_read_work_order_for_role(wo.organization_id, wo.id)
      )
      or exists (
        select 1
        from public.work_order_equipment woe
        where woe.organization_id = p_organization_id
          and woe.equipment_id = p_equipment_id
          and public.can_read_work_order_for_role(woe.organization_id, woe.work_order_id)
      )
    );
$$;

revoke all on function public.can_read_equipment_for_role(uuid, uuid) from public;
grant execute on function public.can_read_equipment_for_role(uuid, uuid) to authenticated;

create or replace function public.can_read_org_document_attachment_for_role(
  p_organization_id uuid,
  p_related_entity_type text,
  p_related_entity_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select
    public.is_org_member(p_organization_id)
    and (
      not public.has_org_role(p_organization_id, array['tech'])
      or case p_related_entity_type
        when 'work_order' then public.can_read_work_order_for_role(p_organization_id, p_related_entity_id)
        when 'customer' then public.can_read_customer_for_role(p_organization_id, p_related_entity_id)
        when 'equipment' then public.can_read_equipment_for_role(p_organization_id, p_related_entity_id)
        when 'calibration_record' then exists (
          select 1
          from public.calibration_records cr
          where cr.organization_id = p_organization_id
            and cr.id = p_related_entity_id
            and (
              public.can_read_work_order_for_role(cr.organization_id, cr.work_order_id)
              or public.can_read_equipment_for_role(cr.organization_id, cr.equipment_id)
            )
        )
        when 'invoice' then false
        when 'quote' then false
        else false
      end
    );
$$;

revoke all on function public.can_read_org_document_attachment_for_role(uuid, text, uuid) from public;
grant execute on function public.can_read_org_document_attachment_for_role(uuid, text, uuid) to authenticated;

create or replace function public.can_read_work_order_attachment_object(
  p_organization_id uuid,
  p_storage_path text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  path_parts text[];
  entity_id uuid;
begin
  if not public.is_org_member(p_organization_id) then
    return false;
  end if;

  if not public.has_org_role(p_organization_id, array['tech']) then
    return true;
  end if;

  path_parts := string_to_array(p_storage_path, '/');

  -- Legacy work-order/certificate object paths: {org}/{work_order}/{file}.
  if array_length(path_parts, 1) >= 2 and path_parts[2] ~ '^[0-9a-fA-F-]{36}$' then
    entity_id := path_parts[2]::uuid;
    return public.can_read_work_order_for_role(p_organization_id, entity_id);
  end if;

  -- Unified document paths: {org}/documents/{entity_type}/{entity_id}/{file}.
  if array_length(path_parts, 1) >= 4
    and path_parts[2] = 'documents'
    and path_parts[4] ~ '^[0-9a-fA-F-]{36}$'
  then
    entity_id := path_parts[4]::uuid;
    return public.can_read_org_document_attachment_for_role(p_organization_id, path_parts[3], entity_id);
  end if;

  return false;
end;
$$;

revoke all on function public.can_read_work_order_attachment_object(uuid, text) from public;
grant execute on function public.can_read_work_order_attachment_object(uuid, text) to authenticated;

create or replace function public.prevent_unassigned_tech_work_order_admin_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if public.has_org_role(old.organization_id, array['owner', 'admin', 'manager']) then
    return new;
  end if;

  if not public.has_org_role(old.organization_id, array['tech']) then
    return new;
  end if;

  if not public.can_read_work_order_for_role(old.organization_id, old.id) then
    raise exception 'work order update is not allowed for this role';
  end if;

  if new.organization_id is distinct from old.organization_id
    or new.customer_id is distinct from old.customer_id
    or new.equipment_id is distinct from old.equipment_id
    or new.assigned_user_id is distinct from old.assigned_user_id
    or new.assigned_technician_id is distinct from old.assigned_technician_id
    or new.scheduled_on is distinct from old.scheduled_on
    or new.scheduled_time is distinct from old.scheduled_time
    or new.invoice_number is distinct from old.invoice_number
    or new.billing_state is distinct from old.billing_state
    or new.billable_to_customer is distinct from old.billable_to_customer
    or new.warranty_review_required is distinct from old.warranty_review_required
    or new.warranty_vendor_id is distinct from old.warranty_vendor_id
    or new.maintenance_plan_id is distinct from old.maintenance_plan_id
    or new.calibration_template_id is distinct from old.calibration_template_id
    or new.created_by is distinct from old.created_by
    or new.created_by_pm_automation is distinct from old.created_by_pm_automation
    or new.archived_at is distinct from old.archived_at
    or new.archived_by is distinct from old.archived_by
    or new.archive_reason is distinct from old.archive_reason
  then
    raise exception 'administrative work order fields are not editable for this role';
  end if;

  if new.status = 'invoiced' and new.status is distinct from old.status then
    raise exception 'invoice status is not editable for this role';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_unassigned_tech_work_order_admin_update() from public, anon, authenticated;

drop trigger if exists trg_work_orders_prevent_tech_admin_update on public.work_orders;
create trigger trg_work_orders_prevent_tech_admin_update
before update on public.work_orders
for each row execute function public.prevent_unassigned_tech_work_order_admin_update();

-- Work orders and related customer/equipment records.
drop policy if exists "work_orders_select_member" on public.work_orders;
create policy "work_orders_select_member"
on public.work_orders
for select
to authenticated
using (public.can_read_work_order_for_role(organization_id, id));

drop policy if exists "work_orders_update_assigned_tech_workflow" on public.work_orders;
create policy "work_orders_update_assigned_tech_workflow"
on public.work_orders
for update
to authenticated
using (
  public.has_org_role(organization_id, array['tech'])
  and public.can_read_work_order_for_role(organization_id, id)
)
with check (
  public.has_org_role(organization_id, array['tech'])
  and public.can_read_work_order_for_role(organization_id, id)
);

drop policy if exists "customers_select_member" on public.customers;
create policy "customers_select_member"
on public.customers
for select
to authenticated
using (public.can_read_customer_for_role(organization_id, id));

drop policy if exists "customer_contacts_select_member" on public.customer_contacts;
create policy "customer_contacts_select_member"
on public.customer_contacts
for select
to authenticated
using (public.can_read_customer_for_role(organization_id, customer_id));

drop policy if exists "customer_locations_select_member" on public.customer_locations;
create policy "customer_locations_select_member"
on public.customer_locations
for select
to authenticated
using (public.can_read_customer_for_role(organization_id, customer_id));

drop policy if exists "equipment_select_member" on public.equipment;
create policy "equipment_select_member"
on public.equipment
for select
to authenticated
using (public.can_read_equipment_for_role(organization_id, id));

drop policy if exists "work_order_equipment_select_member" on public.work_order_equipment;
create policy "work_order_equipment_select_member"
on public.work_order_equipment
for select
to authenticated
using (public.can_read_work_order_for_role(organization_id, work_order_id));

-- Work-order workflow artifacts.
drop policy if exists "work_order_tasks_select_member" on public.work_order_tasks;
create policy "work_order_tasks_select_member"
on public.work_order_tasks for select to authenticated
using (public.can_read_work_order_for_role(organization_id, work_order_id));

drop policy if exists "work_order_tasks_write_roles" on public.work_order_tasks;
create policy "work_order_tasks_write_roles"
on public.work_order_tasks for all to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  or public.can_write_assigned_work_order_artifact(organization_id, work_order_id)
)
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  or public.can_write_assigned_work_order_artifact(organization_id, work_order_id)
);

drop policy if exists "work_order_line_items_select_member" on public.work_order_line_items;
create policy "work_order_line_items_select_member"
on public.work_order_line_items for select to authenticated
using (public.can_read_work_order_for_role(organization_id, work_order_id));

drop policy if exists "work_order_line_items_write_roles" on public.work_order_line_items;
create policy "work_order_line_items_write_roles"
on public.work_order_line_items for all to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  or public.can_write_assigned_work_order_artifact(organization_id, work_order_id)
)
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  or public.can_write_assigned_work_order_artifact(organization_id, work_order_id)
);

drop policy if exists "work_order_attachments_select_member" on public.work_order_attachments;
create policy "work_order_attachments_select_member"
on public.work_order_attachments for select to authenticated
using (public.can_read_work_order_for_role(organization_id, work_order_id));

drop policy if exists "work_order_attachments_write_roles" on public.work_order_attachments;
create policy "work_order_attachments_write_roles"
on public.work_order_attachments for all to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  or public.can_write_assigned_work_order_artifact(organization_id, work_order_id)
)
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  or public.can_write_assigned_work_order_artifact(organization_id, work_order_id)
);

-- Scheduling events: technicians may read assigned-work events and add notes only.
drop policy if exists "wo_scheduling_events_select_member" on public.work_order_scheduling_events;
create policy "wo_scheduling_events_select_member"
on public.work_order_scheduling_events for select to authenticated
using (public.can_read_work_order_for_role(organization_id, work_order_id));

drop policy if exists "wo_scheduling_events_insert_dispatcher" on public.work_order_scheduling_events;
create policy "wo_scheduling_events_insert_dispatcher"
on public.work_order_scheduling_events for insert to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  or (
    public.has_org_role(organization_id, array['tech'])
    and event_type = 'note'
    and public.can_read_work_order_for_role(organization_id, work_order_id)
  )
);

-- Financial resources remain visible to non-tech org members, but are not
-- directly readable by DB-role technicians.
drop policy if exists "org_quotes_select_member" on public.org_quotes;
create policy "org_quotes_select_member"
on public.org_quotes
for select
to authenticated
using (
  public.is_org_member(organization_id)
  and not public.has_org_role(organization_id, array['tech'])
);

drop policy if exists "org_invoices_select_member" on public.org_invoices;
create policy "org_invoices_select_member"
on public.org_invoices
for select
to authenticated
using (
  public.is_org_member(organization_id)
  and not public.has_org_role(organization_id, array['tech'])
);

drop policy if exists "org_purchase_orders_select_member" on public.org_purchase_orders;
create policy "org_purchase_orders_select_member"
on public.org_purchase_orders
for select
to authenticated
using (
  public.is_org_member(organization_id)
  and not public.has_org_role(organization_id, array['tech'])
);

-- Certificate/document metadata.
drop policy if exists "calibration_records_select_member" on public.calibration_records;
create policy "calibration_records_select_member"
on public.calibration_records
for select
to authenticated
using (public.can_read_work_order_for_role(organization_id, work_order_id));

drop policy if exists "certificate_attachments_select_member" on public.certificate_attachments;
create policy "certificate_attachments_select_member"
on public.certificate_attachments for select to authenticated
using (public.can_read_work_order_for_role(organization_id, work_order_id));

drop policy if exists "org_document_attachments_select_member" on public.org_document_attachments;
create policy "org_document_attachments_select_member"
on public.org_document_attachments for select to authenticated
using (
  deleted_at is null
  and public.can_read_org_document_attachment_for_role(organization_id, related_entity_type, related_entity_id)
);

drop policy if exists "org_document_attachments_write_roles" on public.org_document_attachments;
drop policy if exists "org_document_attachments_insert_roles" on public.org_document_attachments;
drop policy if exists "org_document_attachments_update_roles" on public.org_document_attachments;
drop policy if exists "org_document_attachments_delete_roles" on public.org_document_attachments;

create policy "org_document_attachments_insert_roles"
on public.org_document_attachments for insert to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  or (
    public.has_org_role(organization_id, array['tech'])
    and related_entity_type in ('work_order', 'customer', 'equipment', 'calibration_record')
    and portal_visible = false
    and visibility_scope = 'internal'
    and public.can_read_org_document_attachment_for_role(organization_id, related_entity_type, related_entity_id)
  )
);

create policy "org_document_attachments_update_roles"
on public.org_document_attachments for update to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  or (
    public.has_org_role(organization_id, array['tech'])
    and deleted_at is null
    and related_entity_type in ('work_order', 'customer', 'equipment', 'calibration_record')
    and public.can_read_org_document_attachment_for_role(organization_id, related_entity_type, related_entity_id)
  )
)
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  or (
    public.has_org_role(organization_id, array['tech'])
    and related_entity_type in ('work_order', 'customer', 'equipment', 'calibration_record')
    and portal_visible = false
    and visibility_scope = 'internal'
    and public.can_read_org_document_attachment_for_role(organization_id, related_entity_type, related_entity_id)
  )
);

create policy "org_document_attachments_delete_roles"
on public.org_document_attachments for delete to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  or (
    public.has_org_role(organization_id, array['tech'])
    and deleted_at is null
    and related_entity_type in ('work_order', 'customer', 'equipment', 'calibration_record')
    and public.can_read_org_document_attachment_for_role(organization_id, related_entity_type, related_entity_id)
  )
);

-- Private storage bucket metadata. Signed URL APIs still use service-role checks,
-- but direct Supabase storage listing/downloads now inherit assigned-work scope.
drop policy if exists "wo_attachments_select_member" on storage.objects;
create policy "wo_attachments_select_member"
on storage.objects for select to authenticated
using (
  bucket_id = 'work-order-attachments'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  and public.can_read_work_order_attachment_object(split_part(name, '/', 1)::uuid, name)
);
