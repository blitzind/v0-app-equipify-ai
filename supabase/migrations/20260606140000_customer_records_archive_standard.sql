-- Standard archive metadata for tenant-owned records (soft-delete only; no hard-delete).

-- -----------------------------------------------------------------------------
-- Core CRM tables: who archived + optional reason
-- -----------------------------------------------------------------------------
alter table public.customers
  add column if not exists archived_by uuid references auth.users (id) on delete set null;

alter table public.customers
  add column if not exists archive_reason text;

alter table public.equipment
  add column if not exists archived_by uuid references auth.users (id) on delete set null;

alter table public.equipment
  add column if not exists archive_reason text;

alter table public.work_orders
  add column if not exists archived_by uuid references auth.users (id) on delete set null;

alter table public.work_orders
  add column if not exists archive_reason text;

alter table public.maintenance_plans
  add column if not exists archived_by uuid references auth.users (id) on delete set null;

alter table public.maintenance_plans
  add column if not exists archive_reason text;

alter table public.calibration_templates
  add column if not exists archived_by uuid references auth.users (id) on delete set null;

alter table public.calibration_templates
  add column if not exists archive_reason text;

-- -----------------------------------------------------------------------------
-- Completed calibration certificates (per work order)
-- -----------------------------------------------------------------------------
alter table public.calibration_records
  add column if not exists is_archived boolean not null default false;

alter table public.calibration_records
  add column if not exists archived_at timestamptz;

alter table public.calibration_records
  add column if not exists archived_by uuid references auth.users (id) on delete set null;

alter table public.calibration_records
  add column if not exists archive_reason text;

alter table public.calibration_records
  drop constraint if exists calibration_records_archive_consistency;

alter table public.calibration_records
  add constraint calibration_records_archive_consistency check (
    (is_archived = false and archived_at is null)
    or (is_archived = true and archived_at is not null)
  );

create index if not exists idx_calibration_records_org_archived_created
  on public.calibration_records (organization_id, is_archived, created_at desc);

-- -----------------------------------------------------------------------------
-- Quotes / invoices: explicit is_archived aligned with archived_at
-- -----------------------------------------------------------------------------
alter table public.org_quotes
  add column if not exists is_archived boolean not null default false;

alter table public.org_quotes
  add column if not exists archived_by uuid references auth.users (id) on delete set null;

alter table public.org_quotes
  add column if not exists archive_reason text;

alter table public.org_invoices
  add column if not exists is_archived boolean not null default false;

alter table public.org_invoices
  add column if not exists archived_by uuid references auth.users (id) on delete set null;

alter table public.org_invoices
  add column if not exists archive_reason text;

update public.org_quotes
set is_archived = true
where archived_at is not null;

update public.org_invoices
set is_archived = true
where archived_at is not null;

alter table public.org_quotes
  drop constraint if exists org_quotes_archive_consistency;

alter table public.org_quotes
  add constraint org_quotes_archive_consistency check (
    (is_archived = false and archived_at is null)
    or (is_archived = true and archived_at is not null)
  );

alter table public.org_invoices
  drop constraint if exists org_invoices_archive_consistency;

alter table public.org_invoices
  add constraint org_invoices_archive_consistency check (
    (is_archived = false and archived_at is null)
    or (is_archived = true and archived_at is not null)
  );

create index if not exists idx_org_quotes_org_archived
  on public.org_quotes (organization_id, is_archived);

create index if not exists idx_org_invoices_org_archived
  on public.org_invoices (organization_id, is_archived);
