-- BlitzPay Phase 2F — idempotent receipt / staff notification dispatch log (service role writes only).

create table if not exists public.blitzpay_payment_receipt_dispatches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  org_invoice_id uuid not null references public.org_invoices (id) on delete cascade,
  blitzpay_payment_intent_id uuid not null references public.blitzpay_payment_intents (id) on delete cascade,
  source_kind text not null
    check (source_kind in ('webhook_auto', 'staff_resend')),
  target_channel text not null
    check (target_channel in ('customer_receipt', 'staff_alert')),
  send_status text not null
    check (send_status in ('queued', 'sent', 'skipped_no_email', 'skipped_unconfigured', 'failed')),
  provider_message_id text,
  error_detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_payment_receipt_dispatches is
  'BlitzPay receipt/staff email idempotency: one webhook_auto row per (payment_intent, target_channel); staff_resend may repeat.';

create unique index if not exists idx_blitzpay_receipt_dispatch_webhook_customer_unique
  on public.blitzpay_payment_receipt_dispatches (blitzpay_payment_intent_id, target_channel)
  where source_kind = 'webhook_auto' and target_channel = 'customer_receipt';

create unique index if not exists idx_blitzpay_receipt_dispatch_webhook_staff_unique
  on public.blitzpay_payment_receipt_dispatches (blitzpay_payment_intent_id, target_channel)
  where source_kind = 'webhook_auto' and target_channel = 'staff_alert';

create index if not exists idx_blitzpay_receipt_dispatch_org_invoice_created
  on public.blitzpay_payment_receipt_dispatches (organization_id, org_invoice_id, created_at desc);

revoke all on table public.blitzpay_payment_receipt_dispatches from public, anon, authenticated;

alter table public.blitzpay_payment_receipt_dispatches enable row level security;
alter table public.blitzpay_payment_receipt_dispatches force row level security;
