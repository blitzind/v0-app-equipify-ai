-- Idempotent sent_at columns for quote/invoice send tracking.
-- Safe to run repeatedly across environments with drifted migration history.

alter table public.org_invoices
  add column if not exists sent_at timestamptz null;

alter table public.org_quotes
  add column if not exists sent_at timestamptz null;

comment on column public.org_invoices.sent_at is
  'When the invoice was emailed or otherwise sent to the customer.';

comment on column public.org_quotes.sent_at is
  'When the quote was emailed or otherwise sent to the customer.';
