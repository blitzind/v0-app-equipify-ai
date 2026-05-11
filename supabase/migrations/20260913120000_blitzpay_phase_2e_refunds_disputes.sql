-- BlitzPay Phase 2E — staff refunds, dispute tracking, webhook-safe bookkeeping.

-- ---------------------------------------------------------------------------
-- 1) Invoice-scoped BlitzPay refunds (Stripe refund id is global idempotency key)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_invoice_refunds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  org_invoice_id uuid not null references public.org_invoices (id) on delete cascade,
  org_invoice_payment_id uuid not null references public.org_invoice_payments (id) on delete restrict,
  blitzpay_payment_intent_id uuid references public.blitzpay_payment_intents (id) on delete set null,
  stripe_charge_id text not null,
  stripe_refund_id text not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null,
  status text not null
    check (status in ('pending', 'succeeded', 'failed', 'canceled')),
  applied_on date,
  staff_user_id uuid references auth.users (id) on delete set null,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_invoice_refunds is
  'BlitzPay card refunds against org_invoice_payments; stripe_refund_id dedupes webhook replay.';

create unique index if not exists idx_blitzpay_invoice_refunds_stripe_refund
  on public.blitzpay_invoice_refunds (stripe_refund_id);

create unique index if not exists idx_blitzpay_invoice_refunds_org_idempotency
  on public.blitzpay_invoice_refunds (organization_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_blitzpay_invoice_refunds_org_invoice
  on public.blitzpay_invoice_refunds (organization_id, org_invoice_id, created_at desc);

create index if not exists idx_blitzpay_invoice_refunds_org_payment
  on public.blitzpay_invoice_refunds (organization_id, org_invoice_payment_id);

-- ---------------------------------------------------------------------------
-- 2) Lightweight dispute rows (no evidence workflow in 2E)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_invoice_disputes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  org_invoice_id uuid not null references public.org_invoices (id) on delete cascade,
  blitzpay_payment_intent_id uuid references public.blitzpay_payment_intents (id) on delete set null,
  stripe_dispute_id text not null,
  stripe_charge_id text not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null,
  status text not null,
  opened_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_invoice_disputes is
  'Stripe chargeback/dispute mirror for staff support; not exposed on customer portal.';

create unique index if not exists idx_blitzpay_invoice_disputes_stripe
  on public.blitzpay_invoice_disputes (stripe_dispute_id);

create index if not exists idx_blitzpay_invoice_disputes_org_invoice
  on public.blitzpay_invoice_disputes (organization_id, org_invoice_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Grants + RLS (tenant read; writes are service role / server only)
-- ---------------------------------------------------------------------------
revoke all on table public.blitzpay_invoice_refunds from public, anon;
revoke all on table public.blitzpay_invoice_disputes from public, anon;

grant select on table public.blitzpay_invoice_refunds to authenticated;
grant select on table public.blitzpay_invoice_disputes to authenticated;

alter table public.blitzpay_invoice_refunds enable row level security;
alter table public.blitzpay_invoice_refunds force row level security;

alter table public.blitzpay_invoice_disputes enable row level security;
alter table public.blitzpay_invoice_disputes force row level security;

drop policy if exists "blitzpay_invoice_refunds_select_member" on public.blitzpay_invoice_refunds;
create policy "blitzpay_invoice_refunds_select_member"
on public.blitzpay_invoice_refunds
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "blitzpay_invoice_disputes_select_member" on public.blitzpay_invoice_disputes;
create policy "blitzpay_invoice_disputes_select_member"
on public.blitzpay_invoice_disputes
for select
to authenticated
using (public.is_org_member (organization_id));
