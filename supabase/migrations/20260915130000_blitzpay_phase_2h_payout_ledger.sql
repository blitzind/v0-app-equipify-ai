-- BlitzPay Phase 2H — payout ledger, balance transactions, reconciliation runs (org-scoped).

-- ---------------------------------------------------------------------------
-- 1) Stripe payouts mirrored for connected accounts
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_payouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  stripe_connect_account_id text not null,
  stripe_payout_id text not null,
  status text not null,
  amount_cents bigint not null,
  currency text not null,
  arrival_date date,
  stripe_created_at timestamptz not null,
  livemode boolean not null default false,
  method text,
  description text,
  failure_message text,
  failure_code text,
  automatic boolean,
  metadata jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  balance_transaction_synced_at timestamptz,
  balance_transaction_count int not null default 0 check (balance_transaction_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_payouts is
  'Stripe Connect payout rows (po_) synced from webhooks/API; staff/admin visibility only.';

create unique index if not exists idx_blitzpay_payouts_stripe_payout_unique
  on public.blitzpay_payouts (stripe_payout_id);

create index if not exists idx_blitzpay_payouts_org_arrival
  on public.blitzpay_payouts (organization_id, arrival_date desc nulls last);

create index if not exists idx_blitzpay_payouts_org_status
  on public.blitzpay_payouts (organization_id, status, stripe_created_at desc);

-- ---------------------------------------------------------------------------
-- 2) Balance transactions tied to payouts (and optional PI link)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_balance_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  stripe_connect_account_id text not null,
  blitzpay_payout_id uuid references public.blitzpay_payouts (id) on delete set null,
  stripe_payout_id text,
  stripe_balance_transaction_id text not null,
  balance_type text not null,
  reporting_category text,
  stripe_source_id text,
  blitzpay_payment_intent_id uuid references public.blitzpay_payment_intents (id) on delete set null,
  gross_cents bigint not null,
  fee_cents bigint not null default 0,
  net_cents bigint not null,
  currency text not null,
  stripe_created_at timestamptz not null,
  livemode boolean not null default false,
  available_on date,
  synced_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_balance_transactions is
  'Stripe balance transactions (txn_) for connected accounts, usually synced per payout; staff/admin only.';

create unique index if not exists idx_blitzpay_bt_org_txn_unique
  on public.blitzpay_balance_transactions (organization_id, stripe_balance_transaction_id);

create index if not exists idx_blitzpay_bt_org_created
  on public.blitzpay_balance_transactions (organization_id, stripe_created_at desc);

create index if not exists idx_blitzpay_bt_org_payout
  on public.blitzpay_balance_transactions (organization_id, blitzpay_payout_id)
  where blitzpay_payout_id is not null;

create index if not exists idx_blitzpay_bt_pi
  on public.blitzpay_balance_transactions (blitzpay_payment_intent_id)
  where blitzpay_payment_intent_id is not null;

-- ---------------------------------------------------------------------------
-- 3) Reconciliation run log (manual sync + optional webhook bookkeeping)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  trigger text not null
    check (trigger in ('manual_api', 'webhook_payout')),
  status text not null
    check (status in ('started', 'success', 'failed')),
  stripe_connect_account_id text not null,
  stripe_payout_id text,
  payouts_touched int not null default 0 check (payouts_touched >= 0),
  balance_transactions_upserted int not null default 0 check (balance_transactions_upserted >= 0),
  summary jsonb not null default '{}'::jsonb,
  error text,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

comment on table public.blitzpay_reconciliation_runs is
  'Audit log for BlitzPay payout/balance-transaction sync and reconciliation attempts.';

create index if not exists idx_blitzpay_recon_runs_org_created
  on public.blitzpay_reconciliation_runs (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Grants + RLS
-- ---------------------------------------------------------------------------
revoke all on table public.blitzpay_payouts from public, anon;
revoke all on table public.blitzpay_balance_transactions from public, anon;
revoke all on table public.blitzpay_reconciliation_runs from public, anon;

grant select on table public.blitzpay_payouts to authenticated;
grant select on table public.blitzpay_balance_transactions to authenticated;
grant select on table public.blitzpay_reconciliation_runs to authenticated;

alter table public.blitzpay_payouts enable row level security;
alter table public.blitzpay_payouts force row level security;

alter table public.blitzpay_balance_transactions enable row level security;
alter table public.blitzpay_balance_transactions force row level security;

alter table public.blitzpay_reconciliation_runs enable row level security;
alter table public.blitzpay_reconciliation_runs force row level security;

drop policy if exists "blitzpay_payouts_select_member" on public.blitzpay_payouts;
create policy "blitzpay_payouts_select_member"
on public.blitzpay_payouts
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "blitzpay_balance_transactions_select_member" on public.blitzpay_balance_transactions;
create policy "blitzpay_balance_transactions_select_member"
on public.blitzpay_balance_transactions
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "blitzpay_reconciliation_runs_select_member" on public.blitzpay_reconciliation_runs;
create policy "blitzpay_reconciliation_runs_select_member"
on public.blitzpay_reconciliation_runs
for select
to authenticated
using (public.is_org_member (organization_id));
