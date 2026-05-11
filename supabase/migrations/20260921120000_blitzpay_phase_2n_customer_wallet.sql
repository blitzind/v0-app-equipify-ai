-- BlitzPay Phase 2N — org-scoped customer wallet, ledger, credits & unapplied-funds foundations.

create table if not exists public.blitzpay_customer_wallets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  available_credit_cents bigint not null default 0,
  refundable_credit_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blitzpay_customer_wallets_available_non_negative check (available_credit_cents >= 0),
  constraint blitzpay_customer_wallets_refundable_non_negative check (refundable_credit_cents >= 0),
  constraint blitzpay_customer_wallets_refundable_lte_available check (refundable_credit_cents <= available_credit_cents),
  unique (organization_id, customer_id)
);

comment on table public.blitzpay_customer_wallets is
  'BlitzPay Phase 2N: spendable customer credits (overpayments, manual credits). Mutations via service role / API only.';
comment on column public.blitzpay_customer_wallets.available_credit_cents is
  'Net wallet balance from wallet ledger (credits minus applications and clawbacks).';
comment on column public.blitzpay_customer_wallets.refundable_credit_cents is
  'Subset eligible for refund treatment (Phase 2N: mirrors available for hosted-pay overpayment credits).';

create table if not exists public.blitzpay_customer_wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  wallet_id uuid not null references public.blitzpay_customer_wallets (id) on delete cascade,
  entry_kind text not null,
  amount_cents bigint not null,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  org_invoice_id uuid references public.org_invoices (id) on delete set null,
  org_quote_id uuid references public.org_quotes (id) on delete set null,
  work_order_id uuid references public.work_orders (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint blitzpay_wallet_ledger_kind_chk check (
    entry_kind in (
      'credit_overpayment_invoice',
      'credit_manual',
      'debit_apply_invoice',
      'debit_refund_clawback'
    )
  )
);

comment on table public.blitzpay_customer_wallet_ledger is
  'Signed movements: positive amount_cents credits the wallet; negative debits. Idempotency_key prevents double-posting.';
comment on column public.blitzpay_customer_wallet_ledger.amount_cents is
  'Signed cents: positive adds to wallet balance, negative subtracts.';

create unique index if not exists idx_blitzpay_wallet_ledger_idem
  on public.blitzpay_customer_wallet_ledger (organization_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_blitzpay_wallet_ledger_wallet_created
  on public.blitzpay_customer_wallet_ledger (wallet_id, created_at desc);

create index if not exists idx_blitzpay_wallet_ledger_org_customer_created
  on public.blitzpay_customer_wallet_ledger (organization_id, customer_id, created_at desc);

create index if not exists idx_blitzpay_customer_wallets_org
  on public.blitzpay_customer_wallets (organization_id, updated_at desc);

revoke all on table public.blitzpay_customer_wallets from public, anon;
grant select on table public.blitzpay_customer_wallets to authenticated;

alter table public.blitzpay_customer_wallets enable row level security;
alter table public.blitzpay_customer_wallets force row level security;

drop policy if exists "blitzpay_customer_wallets_select_member" on public.blitzpay_customer_wallets;
create policy "blitzpay_customer_wallets_select_member"
on public.blitzpay_customer_wallets
for select
to authenticated
using (public.is_org_member (organization_id));

revoke all on table public.blitzpay_customer_wallet_ledger from public, anon;
grant select on table public.blitzpay_customer_wallet_ledger to authenticated;

alter table public.blitzpay_customer_wallet_ledger enable row level security;
alter table public.blitzpay_customer_wallet_ledger force row level security;

drop policy if exists "blitzpay_customer_wallet_ledger_select_member" on public.blitzpay_customer_wallet_ledger;
create policy "blitzpay_customer_wallet_ledger_select_member"
on public.blitzpay_customer_wallet_ledger
for select
to authenticated
using (public.is_org_member (organization_id));
