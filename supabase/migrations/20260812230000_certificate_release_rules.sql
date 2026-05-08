-- Phase 16: Certificate release rules and attachment release metadata.
-- Extends existing portal certificate release policy without replacing the
-- certificate, invoice, or unified attachment systems.

-- Existing mode column names are retained for compatibility. Add internal_only
-- and richer customer notes/reasons used by staff UI.
alter table public.organizations
  drop constraint if exists organizations_portal_certificate_release_mode_check;

alter table public.organizations
  add constraint organizations_portal_certificate_release_mode_check
  check (
    portal_certificate_release_mode is null or portal_certificate_release_mode in (
      'immediate_release',
      'release_on_payment',
      'manual_release',
      'internal_only'
    )
  );

alter table public.customers
  add column if not exists certificate_release_requires_paid_invoice boolean not null default false,
  add column if not exists certificate_release_notes text,
  add column if not exists certificate_release_override_reason text;

alter table public.customers
  drop constraint if exists customers_portal_certificate_release_mode_check;

alter table public.customers
  add constraint customers_portal_certificate_release_mode_check
  check (
    portal_certificate_release_mode is null or portal_certificate_release_mode in (
      'immediate_release',
      'release_on_payment',
      'manual_release',
      'internal_only'
    )
  );

alter table public.customers
  alter column certificate_release_requires_paid_invoice
  set default false;

comment on column public.customers.portal_certificate_release_mode is
  'Optional customer override for portal certificate release; null inherits organization default. Values: immediate_release | release_on_payment | manual_release | internal_only.';
comment on column public.customers.certificate_release_requires_paid_invoice is
  'Compatibility flag for reporting/UI; true when the customer policy requires paid invoice release.';
comment on column public.customers.certificate_release_notes is
  'Internal notes explaining this customer certificate release policy.';
comment on column public.customers.certificate_release_override_reason is
  'Internal reason for overriding workspace certificate release default.';

alter table public.org_invoices
  drop constraint if exists org_invoices_portal_certificate_release_override_check;

alter table public.org_invoices
  add constraint org_invoices_portal_certificate_release_override_check
  check (
    portal_certificate_release_override is null or portal_certificate_release_override in (
      'immediate_release',
      'release_on_payment',
      'manual_release',
      'internal_only'
    )
  );

-- Generated certificate release audit.
alter table public.calibration_records
  add column if not exists portal_released_by uuid references auth.users (id) on delete set null,
  add column if not exists portal_revoked_at timestamptz,
  add column if not exists portal_revoked_by uuid references auth.users (id) on delete set null,
  add column if not exists portal_withheld_reason text;

comment on column public.calibration_records.portal_released_by is
  'Staff user who manually released this generated certificate to the portal.';
comment on column public.calibration_records.portal_revoked_at is
  'When portal access was revoked for this generated certificate.';
comment on column public.calibration_records.portal_withheld_reason is
  'Internal reason this generated certificate is withheld from portal access.';

-- Unified attachment release state. Existing rows keep working because old
-- statuses remain allowed; new rows can use the Phase 16 status vocabulary.
alter table public.org_document_attachments
  add column if not exists release_mode_snapshot text,
  add column if not exists released_at timestamptz,
  add column if not exists released_by uuid references auth.users (id) on delete set null,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references auth.users (id) on delete set null,
  add column if not exists withheld_reason text,
  add column if not exists linked_invoice_id uuid references public.org_invoices (id) on delete set null,
  add column if not exists linked_work_order_id uuid references public.work_orders (id) on delete set null,
  add column if not exists linked_customer_id uuid references public.customers (id) on delete set null,
  add column if not exists release_notes text;

alter table public.org_document_attachments
  drop constraint if exists org_document_attachments_release_check;

alter table public.org_document_attachments
  add constraint org_document_attachments_release_check
  check (
    portal_release_status in (
      'internal',
      'pending',
      'pending_release',
      'withheld_invoice_unpaid',
      'released',
      'released_after_payment',
      'manual_hold',
      'revoked'
    )
  );

alter table public.org_document_attachments
  drop constraint if exists org_document_attachments_release_mode_snapshot_check;

alter table public.org_document_attachments
  add constraint org_document_attachments_release_mode_snapshot_check
  check (
    release_mode_snapshot is null or release_mode_snapshot in (
      'immediate_release',
      'release_on_payment',
      'manual_release',
      'internal_only'
    )
  );

create index if not exists idx_org_doc_attach_release_links
  on public.org_document_attachments (organization_id, linked_invoice_id, linked_work_order_id, linked_customer_id)
  where deleted_at is null;

comment on column public.org_document_attachments.release_mode_snapshot is
  'Certificate release policy snapshot when the attachment was uploaded or prepared.';
comment on column public.org_document_attachments.portal_release_status is
  'Portal release state: internal | pending | withheld_invoice_unpaid | released | revoked (legacy pending_release/released_after_payment/manual_hold also accepted).';
comment on column public.org_document_attachments.withheld_reason is
  'Internal explanation for pending/withheld/revoked document access.';
