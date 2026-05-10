-- Phase 37: minimal portal approval metadata (additive).

alter table public.org_quotes
  add column if not exists portal_customer_note text,
  add column if not exists customer_portal_decision_at timestamptz;

comment on column public.org_quotes.portal_customer_note is
  'Optional message from the customer via the portal (e.g. decline reason). Distinct from staff-authored notes.';

comment on column public.org_quotes.customer_portal_decision_at is
  'When the customer last approved or declined this quote through the portal.';
