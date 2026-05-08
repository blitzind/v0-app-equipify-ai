-- Work Orders → Invoices — Phase 4 link metadata
--
-- The canonical flexible join table already exists as
-- public.invoice_work_order_links. Add optional audit/context columns requested
-- for stronger service-to-invoice traceability without changing portal behavior
-- or forcing pricing onto work orders.

alter table public.invoice_work_order_links
  add column if not exists linked_by uuid references auth.users (id) on delete set null,
  add column if not exists linked_at timestamptz not null default now(),
  add column if not exists notes text;

comment on column public.invoice_work_order_links.linked_by is
  'User who linked the work order to the invoice, when known.';
comment on column public.invoice_work_order_links.linked_at is
  'Timestamp when the work order was linked to the invoice.';
comment on column public.invoice_work_order_links.notes is
  'Internal linkage note. Not exposed in customer portal.';
