-- Track when an invoice was emailed/sent to the customer (distinct from issued_at).

alter table public.org_invoices
  add column if not exists sent_at timestamptz;

comment on column public.org_invoices.sent_at is
  'When the invoice was emailed or otherwise sent to the customer.';
