-- Customer Billing + PO Requirements — Phase 3
--
-- Additive customer-level billing/PO settings plus invoice billing snapshots.
-- Parent/child relationships remain advisory for billing; no consolidated
-- billing, tax, or portal permission changes are introduced here.

alter table public.customers
  add column if not exists billing_name text,
  add column if not exists billing_contact_name text,
  add column if not exists billing_contact_phone text,
  add column if not exists billing_country text,
  add column if not exists po_required boolean,
  add column if not exists po_number_required_before_service boolean,
  add column if not exists po_number_required_before_invoice boolean,
  add column if not exists default_po_number text,
  add column if not exists invoice_delivery_preference text,
  add column if not exists invoice_instructions text,
  add column if not exists billing_behavior text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_billing_behavior_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_billing_behavior_check
      check (
        billing_behavior is null or
        billing_behavior in ('own_billing', 'parent_billing', 'custom')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_invoice_delivery_preference_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_invoice_delivery_preference_check
      check (
        invoice_delivery_preference is null or
        invoice_delivery_preference in ('email', 'portal', 'mail', 'manual')
      );
  end if;
end;
$$;

comment on column public.customers.billing_name is
  'Optional bill-to name. If absent, invoices display the customer company name.';
comment on column public.customers.billing_behavior is
  'Billing behavior for hierarchy-aware customers: own_billing, parent_billing, or custom. Does not implement consolidated billing.';
comment on column public.customers.po_required is
  'Whether this customer generally requires a PO number.';
comment on column public.customers.po_number_required_before_service is
  'If true, staff should collect a PO before service begins. Warning-only in this phase.';
comment on column public.customers.po_number_required_before_invoice is
  'If true, staff should collect a PO before invoicing. Warning-only in this phase.';
comment on column public.customers.invoice_instructions is
  'Internal billing/invoice instructions for staff. Do not expose directly in the customer portal.';

alter table public.org_invoices
  add column if not exists billing_customer_id uuid,
  add column if not exists billing_name text,
  add column if not exists billing_contact_name text,
  add column if not exists billing_contact_email text,
  add column if not exists billing_contact_phone text,
  add column if not exists billing_address_line1 text,
  add column if not exists billing_address_line2 text,
  add column if not exists billing_city text,
  add column if not exists billing_state text,
  add column if not exists billing_postal_code text,
  add column if not exists billing_country text,
  add column if not exists po_number text,
  add column if not exists invoice_instructions text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'org_invoices_billing_customer_org_fkey'
      and conrelid = 'public.org_invoices'::regclass
  ) then
    alter table public.org_invoices
      add constraint org_invoices_billing_customer_org_fkey
      foreign key (organization_id, billing_customer_id)
      references public.customers (organization_id, id)
      on delete set null;
  end if;
end;
$$;

create index if not exists idx_org_invoices_billing_customer
  on public.org_invoices (organization_id, billing_customer_id)
  where billing_customer_id is not null;

comment on column public.org_invoices.billing_customer_id is
  'Resolved billing customer snapshot source at invoice creation time.';
comment on column public.org_invoices.invoice_instructions is
  'Snapshot of internal invoice instructions at invoice creation time.';
