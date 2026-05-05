-- Billing-aware INSERT restrictions at the database layer (RLS).
-- Restricted subscription states cannot INSERT new business records via the anon/authenticated PostgREST role.
-- Service role / postgres bypass RLS — cron, webhooks, and automation keep working.
--
-- Allowed subscription statuses for creates (matches app billing gate):
--   active
--   trialing with trial_ends_at > now()
--   past_due
--   incomplete
--
-- Denied examples: unpaid, canceled, paused, incomplete_expired, trialing after trial end.

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function public.can_org_create_records(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(
    (
      select
        s.status = 'active'
        or (
          s.status = 'trialing'
          and s.trial_ends_at is not null
          and s.trial_ends_at > now()
        )
        or s.status = 'past_due'
        or s.status = 'incomplete'
      from public.organization_subscriptions s
      where s.organization_id = org_id
    ),
    false
  );
$$;

comment on function public.can_org_create_records(uuid) is
  'True when the org may create new operational rows (quotes, customers, work orders, etc.) per billing status.';

revoke all on function public.can_org_create_records(uuid) from public;
grant execute on function public.can_org_create_records(uuid) to authenticated;
alter function public.can_org_create_records(uuid) owner to postgres;

-- Maintenance plans require billing OK plus Growth/Scale (or active trial window).
create or replace function public.can_org_insert_maintenance_plan(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select public.can_org_create_records(org_id)
    and exists (
      select 1
      from public.organization_subscriptions s
      where s.organization_id = org_id
        and (
          (
            s.status = 'trialing'
            and s.trial_ends_at is not null
            and s.trial_ends_at > now()
          )
          or s.plan_id in ('growth', 'scale')
        )
    );
$$;

comment on function public.can_org_insert_maintenance_plan(uuid) is
  'Stricter than can_org_create_records: maintenance_plans feature (Growth/Scale or eligible trial).';

revoke all on function public.can_org_insert_maintenance_plan(uuid) from public;
grant execute on function public.can_org_insert_maintenance_plan(uuid) to authenticated;
alter function public.can_org_insert_maintenance_plan(uuid) owner to postgres;

-- -----------------------------------------------------------------------------
-- Customers & nested CRM rows
-- -----------------------------------------------------------------------------

drop policy if exists "customers_insert_owner_admin_manager" on public.customers;
create policy "customers_insert_owner_admin_manager"
on public.customers
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  and public.can_org_create_records(organization_id)
);

drop policy if exists "customer_contacts_insert_owner_admin_manager" on public.customer_contacts;
create policy "customer_contacts_insert_owner_admin_manager"
on public.customer_contacts
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  and public.can_org_create_records(organization_id)
);

drop policy if exists "customer_locations_insert_owner_admin_manager" on public.customer_locations;
create policy "customer_locations_insert_owner_admin_manager"
on public.customer_locations
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  and public.can_org_create_records(organization_id)
);

-- -----------------------------------------------------------------------------
-- Equipment & work orders
-- -----------------------------------------------------------------------------

drop policy if exists "equipment_insert_owner_admin_manager" on public.equipment;
create policy "equipment_insert_owner_admin_manager"
on public.equipment
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  and public.can_org_create_records(organization_id)
);

drop policy if exists "work_orders_insert_owner_admin_manager" on public.work_orders;
create policy "work_orders_insert_owner_admin_manager"
on public.work_orders
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  and public.can_org_create_records(organization_id)
);

-- -----------------------------------------------------------------------------
-- Maintenance plans (billing + plan/trial feature)
-- -----------------------------------------------------------------------------

drop policy if exists "maintenance_plans_insert_owner_admin_manager" on public.maintenance_plans;
create policy "maintenance_plans_insert_owner_admin_manager"
on public.maintenance_plans
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  and public.can_org_insert_maintenance_plan(organization_id)
);

-- -----------------------------------------------------------------------------
-- Quotes & invoices (split ALL policy so UPDATE stays allowed when billing is restricted)
-- -----------------------------------------------------------------------------

drop policy if exists "org_quotes_write_roles" on public.org_quotes;

create policy "org_quotes_insert_roles_billing"
on public.org_quotes
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  and public.can_org_create_records(organization_id)
);

create policy "org_quotes_update_roles"
on public.org_quotes
for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

create policy "org_quotes_delete_roles"
on public.org_quotes
for delete
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "org_invoices_write_roles" on public.org_invoices;

create policy "org_invoices_insert_roles_billing"
on public.org_invoices
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  and public.can_org_create_records(organization_id)
);

create policy "org_invoices_update_roles"
on public.org_invoices
for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

create policy "org_invoices_delete_roles"
on public.org_invoices
for delete
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

-- -----------------------------------------------------------------------------
-- Purchase orders & vendors
-- -----------------------------------------------------------------------------

drop policy if exists "org_purchase_orders_write_roles" on public.org_purchase_orders;

create policy "org_purchase_orders_insert_roles_billing"
on public.org_purchase_orders
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  and public.can_org_create_records(organization_id)
);

create policy "org_purchase_orders_update_roles"
on public.org_purchase_orders
for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

create policy "org_purchase_orders_delete_roles"
on public.org_purchase_orders
for delete
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "org_vendors_write_roles" on public.org_vendors;

create policy "org_vendors_insert_roles_billing"
on public.org_vendors
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  and public.can_org_create_records(organization_id)
);

create policy "org_vendors_update_roles"
on public.org_vendors
for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

create policy "org_vendors_delete_roles"
on public.org_vendors
for delete
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

-- -----------------------------------------------------------------------------
-- Org tasks & job types
-- -----------------------------------------------------------------------------

drop policy if exists "org_tasks_insert_member" on public.org_tasks;
create policy "org_tasks_insert_member"
on public.org_tasks
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and public.can_org_create_records(organization_id)
);

drop policy if exists "organization_job_types_insert_admin" on public.organization_job_types;
create policy "organization_job_types_insert_admin"
on public.organization_job_types
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  and public.can_org_create_records(organization_id)
);

-- -----------------------------------------------------------------------------
-- Calibration
-- -----------------------------------------------------------------------------

drop policy if exists "calibration_templates_write_roles" on public.calibration_templates;

create policy "calibration_templates_insert_roles_billing"
on public.calibration_templates
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  and public.can_org_create_records(organization_id)
);

create policy "calibration_templates_update_roles"
on public.calibration_templates
for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

create policy "calibration_templates_delete_roles"
on public.calibration_templates
for delete
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "calibration_records_write_roles" on public.calibration_records;

create policy "calibration_records_insert_roles_billing"
on public.calibration_records
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  and public.can_org_create_records(organization_id)
);

create policy "calibration_records_update_roles"
on public.calibration_records
for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

create policy "calibration_records_delete_roles"
on public.calibration_records
for delete
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

-- -----------------------------------------------------------------------------
-- Work order detail tables (tasks, line items, attachments, equipment links)
-- -----------------------------------------------------------------------------

drop policy if exists "work_order_tasks_write_roles" on public.work_order_tasks;

create policy "work_order_tasks_insert_roles_billing"
on public.work_order_tasks
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  and public.can_org_create_records(organization_id)
);

create policy "work_order_tasks_update_roles"
on public.work_order_tasks
for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

create policy "work_order_tasks_delete_roles"
on public.work_order_tasks
for delete
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "work_order_line_items_write_roles" on public.work_order_line_items;

create policy "work_order_line_items_insert_roles_billing"
on public.work_order_line_items
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  and public.can_org_create_records(organization_id)
);

create policy "work_order_line_items_update_roles"
on public.work_order_line_items
for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

create policy "work_order_line_items_delete_roles"
on public.work_order_line_items
for delete
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "work_order_attachments_write_roles" on public.work_order_attachments;

create policy "work_order_attachments_insert_roles_billing"
on public.work_order_attachments
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  and public.can_org_create_records(organization_id)
);

create policy "work_order_attachments_update_roles"
on public.work_order_attachments
for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

create policy "work_order_attachments_delete_roles"
on public.work_order_attachments
for delete
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "work_order_equipment_write_roles" on public.work_order_equipment;

create policy "work_order_equipment_insert_roles_billing"
on public.work_order_equipment
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  and public.can_org_create_records(organization_id)
);

create policy "work_order_equipment_update_roles"
on public.work_order_equipment
for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

create policy "work_order_equipment_delete_roles"
on public.work_order_equipment
for delete
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

-- -----------------------------------------------------------------------------
-- Technician profile rows
-- -----------------------------------------------------------------------------

drop policy if exists "technician_certifications_insert" on public.technician_certifications;
create policy "technician_certifications_insert"
on public.technician_certifications
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and (
    public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
    or technician_user_id = auth.uid()
  )
  and public.can_org_create_records(organization_id)
);

drop policy if exists "technician_notes_insert" on public.technician_notes;
create policy "technician_notes_insert"
on public.technician_notes
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and (
    public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
    or technician_user_id = auth.uid()
  )
  and public.can_org_create_records(organization_id)
);

-- -----------------------------------------------------------------------------
-- Maintenance automation audit (member-visible; inserts usually service role)
-- -----------------------------------------------------------------------------

drop policy if exists "mp_automation_events_insert_member" on public.maintenance_plan_automation_events;
create policy "mp_automation_events_insert_member"
on public.maintenance_plan_automation_events
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and public.can_org_create_records(organization_id)
);
