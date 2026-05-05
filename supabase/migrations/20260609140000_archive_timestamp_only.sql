-- Archive standardization (timestamp-only): soft-delete via archived_at / archived_by / archive_reason.
-- Drops legacy is_archived booleans after backfill. Idempotent on environments at different migration states.

-- ─── Ensure metadata columns exist ────────────────────────────────────────────

alter table public.org_quotes
  add column if not exists archived_by uuid references auth.users (id) on delete set null,
  add column if not exists archive_reason text;

alter table public.org_invoices
  add column if not exists archived_by uuid references auth.users (id) on delete set null,
  add column if not exists archive_reason text;

alter table public.org_purchase_orders
  add column if not exists archived_by uuid references auth.users (id) on delete set null,
  add column if not exists archive_reason text;

alter table public.customer_locations
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users (id) on delete set null,
  add column if not exists archive_reason text;

alter table public.customer_contacts
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users (id) on delete set null,
  add column if not exists archive_reason text;

-- ─── Drop consistency constraints that reference is_archived ────────────────

alter table public.equipment drop constraint if exists equipment_archived_consistency;
alter table public.work_orders drop constraint if exists work_orders_archived_consistency;
alter table public.maintenance_plans drop constraint if exists maintenance_plans_archived_consistency;
alter table public.calibration_templates drop constraint if exists calibration_templates_archive_consistency;
alter table public.calibration_records drop constraint if exists calibration_records_archive_consistency;
alter table public.org_vendors drop constraint if exists org_vendors_archive_consistency;
alter table public.org_purchase_orders drop constraint if exists org_purchase_orders_archive_consistency;
alter table public.org_quotes drop constraint if exists org_quotes_archive_consistency;
alter table public.org_invoices drop constraint if exists org_invoices_archive_consistency;

-- ─── Drop indexes that reference is_archived (will recreate with archived_at) ─

drop index if exists public.idx_customers_org_archived;
drop index if exists public.idx_customer_locations_org_archived;
drop index if exists public.idx_customer_contacts_org_customer_archived;
drop index if exists public.idx_equipment_org_archived_status;
drop index if exists public.idx_equipment_org_customer_archived;
drop index if exists public.idx_work_orders_org_archived_status;
drop index if exists public.idx_work_orders_org_archived_scheduled;
drop index if exists public.idx_maintenance_plans_org_archived_status;
drop index if exists public.idx_maintenance_plans_org_next_due;
drop index if exists public.idx_calibration_records_org_archived_created;
drop index if exists public.idx_org_quotes_org_archived;
drop index if exists public.idx_org_invoices_org_archived;
drop index if exists public.idx_org_vendors_org_archived;
drop index if exists public.idx_org_purchase_orders_org_archived;

drop index if exists public.idx_customer_locations_default_per_customer;

-- ─── Backfill archived_at from legacy is_archived (when column still exists) ─

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customers' and column_name = 'is_archived'
  ) then
    update public.customers
      set archived_at = coalesce(archived_at, now())
      where is_archived = true and archived_at is null;
    update public.customers set archived_at = null where is_archived = false;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'equipment' and column_name = 'is_archived'
  ) then
    update public.equipment
      set archived_at = coalesce(archived_at, now())
      where is_archived = true and archived_at is null;
    update public.equipment set archived_at = null where is_archived = false;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'work_orders' and column_name = 'is_archived'
  ) then
    update public.work_orders
      set archived_at = coalesce(archived_at, now())
      where is_archived = true and archived_at is null;
    update public.work_orders set archived_at = null where is_archived = false;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'maintenance_plans' and column_name = 'is_archived'
  ) then
    update public.maintenance_plans
      set archived_at = coalesce(archived_at, now())
      where is_archived = true and archived_at is null;
    update public.maintenance_plans set archived_at = null where is_archived = false;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customer_contacts' and column_name = 'is_archived'
  ) then
    update public.customer_contacts
      set archived_at = coalesce(archived_at, now())
      where is_archived = true and archived_at is null;
    update public.customer_contacts set archived_at = null where is_archived = false;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customer_locations' and column_name = 'is_archived'
  ) then
    update public.customer_locations
      set archived_at = coalesce(archived_at, now())
      where is_archived = true and archived_at is null;
    update public.customer_locations set archived_at = null where is_archived = false;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'calibration_templates' and column_name = 'is_archived'
  ) then
    update public.calibration_templates
      set archived_at = coalesce(archived_at, now())
      where is_archived = true and archived_at is null;
    update public.calibration_templates set archived_at = null where is_archived = false;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'calibration_records' and column_name = 'is_archived'
  ) then
    update public.calibration_records
      set archived_at = coalesce(archived_at, now())
      where is_archived = true and archived_at is null;
    update public.calibration_records set archived_at = null where is_archived = false;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'org_quotes' and column_name = 'is_archived'
  ) then
    update public.org_quotes
      set archived_at = coalesce(archived_at, now())
      where is_archived = true and archived_at is null;
    update public.org_quotes set archived_at = null where is_archived = false;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'org_invoices' and column_name = 'is_archived'
  ) then
    update public.org_invoices
      set archived_at = coalesce(archived_at, now())
      where is_archived = true and archived_at is null;
    update public.org_invoices set archived_at = null where is_archived = false;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'org_vendors' and column_name = 'is_archived'
  ) then
    update public.org_vendors
      set archived_at = coalesce(archived_at, now())
      where is_archived = true and archived_at is null;
    update public.org_vendors set archived_at = null where is_archived = false;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'org_purchase_orders' and column_name = 'is_archived'
  ) then
    update public.org_purchase_orders
      set archived_at = coalesce(archived_at, now())
      where is_archived = true and archived_at is null;
    update public.org_purchase_orders set archived_at = null where is_archived = false;
  end if;
end $$;

-- ─── Drop legacy boolean column ───────────────────────────────────────────────

alter table public.customers drop column if exists is_archived;
alter table public.equipment drop column if exists is_archived;
alter table public.work_orders drop column if exists is_archived;
alter table public.maintenance_plans drop column if exists is_archived;
alter table public.customer_contacts drop column if exists is_archived;
alter table public.customer_locations drop column if exists is_archived;
alter table public.calibration_templates drop column if exists is_archived;
alter table public.calibration_records drop column if exists is_archived;
alter table public.org_quotes drop column if exists is_archived;
alter table public.org_invoices drop column if exists is_archived;
alter table public.org_vendors drop column if exists is_archived;
alter table public.org_purchase_orders drop column if exists is_archived;

-- ─── Replacement indexes (query: active => archived_at is null) ─────────────

create index if not exists idx_customers_org_archived_at
  on public.customers (organization_id, archived_at);

create index if not exists idx_customer_locations_org_archived_at
  on public.customer_locations (organization_id, archived_at);

create index if not exists idx_customer_contacts_org_customer_archived_at
  on public.customer_contacts (organization_id, customer_id, archived_at);

create unique index if not exists idx_customer_locations_default_per_customer
  on public.customer_locations (customer_id)
  where is_default = true and archived_at is null;

create index if not exists idx_equipment_org_archived_status
  on public.equipment (organization_id, archived_at, status);

create index if not exists idx_equipment_org_customer_archived
  on public.equipment (organization_id, customer_id, archived_at);

create index if not exists idx_work_orders_org_archived_status
  on public.work_orders (organization_id, archived_at, status);

create index if not exists idx_work_orders_org_archived_scheduled
  on public.work_orders (organization_id, archived_at, scheduled_on);

create index if not exists idx_maintenance_plans_org_archived_status
  on public.maintenance_plans (organization_id, archived_at, status);

create index if not exists idx_maintenance_plans_org_next_due
  on public.maintenance_plans (organization_id, next_due_date)
  where archived_at is null and next_due_date is not null;

create index if not exists idx_calibration_templates_org_archived_at
  on public.calibration_templates (organization_id, archived_at);

create index if not exists idx_calibration_records_org_archived_created
  on public.calibration_records (organization_id, archived_at, created_at desc);

create index if not exists idx_org_quotes_org_archived_at
  on public.org_quotes (organization_id, archived_at);

create index if not exists idx_org_invoices_org_archived_at
  on public.org_invoices (organization_id, archived_at);

create index if not exists idx_org_vendors_org_archived_at
  on public.org_vendors (organization_id, archived_at);

create index if not exists idx_org_purchase_orders_org_archived_at
  on public.org_purchase_orders (organization_id, archived_at);

-- ─── Warranty trigger: active equipment = archived_at is null ───────────────

create or replace function public.work_orders_apply_warranty_review_default()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  eq_start date;
  eq_exp date;
  active_warranty boolean := false;
begin
  if new.equipment_id is null then
    return new;
  end if;

  select e.warranty_start_date,
         coalesce(e.warranty_expiration_date, e.warranty_expires_at)
    into eq_start, eq_exp
    from public.equipment e
    where e.id = new.equipment_id
      and e.organization_id = new.organization_id
      and e.archived_at is null
    limit 1;

  if eq_exp is not null
     and eq_exp >= current_date
     and (eq_start is null or eq_start <= current_date) then
    active_warranty := true;
  end if;

  if active_warranty then
    new.warranty_review_required := true;
  elsif tg_op = 'INSERT' and new.warranty_review_required is null then
    new.warranty_review_required := false;
  end if;

  if tg_op = 'INSERT' and new.billable_to_customer is null then
    new.billable_to_customer := true;
  end if;

  return new;
end;
$$;
