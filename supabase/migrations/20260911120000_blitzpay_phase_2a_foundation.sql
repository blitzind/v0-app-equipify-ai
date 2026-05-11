-- BlitzPay Phase 2A — tenant payment foundation (tables, indexes, RLS).
-- SaaS billing remains on organization_subscriptions + /api/stripe/webhook.
-- Writes: service role / server only. Authenticated: org-scoped SELECT where noted.

-- ---------------------------------------------------------------------------
-- 1) Org-level BlitzPay pay settings (server-controlled fee + feature flags)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_org_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  blitzpay_invoice_pay_enabled boolean not null default false,
  platform_fee_bps int not null default 0
    check (platform_fee_bps >= 0 and platform_fee_bps <= 10000),
  platform_fee_fixed_cents int not null default 0
    check (platform_fee_fixed_cents >= 0),
  convenience_fee_mode text not null default 'none'
    check (
      convenience_fee_mode in (
        'none',
        'pass_stripe_cost_estimate',
        'fixed_cents',
        'bps'
      )
    ),
  max_open_checkout_sessions_per_invoice int not null default 1
    check (max_open_checkout_sessions_per_invoice >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_org_settings is
  'Per-tenant BlitzPay invoice pay flags and fee policy inputs; fee snapshots are immutable per charge.';

create index if not exists idx_blitzpay_org_settings_invoice_pay
  on public.blitzpay_org_settings (organization_id)
  where blitzpay_invoice_pay_enabled;

-- ---------------------------------------------------------------------------
-- 2) PaymentIntent mirror (Stripe-shaped source of truth pre-reconciliation)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_payment_intents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  stripe_connect_account_id text not null,
  stripe_payment_intent_id text not null,
  stripe_checkout_session_id text,
  status text not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null,
  application_fee_cents bigint check (application_fee_cents is null or application_fee_cents >= 0),
  convenience_fee_cents bigint not null default 0 check (convenience_fee_cents >= 0),
  invoice_amount_cents bigint,
  org_invoice_id uuid references public.org_invoices (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  last_stripe_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_payment_intents is
  'Stripe PaymentIntent rows for BlitzPay (Connect); reconcile to org_invoice_payments after succeeded.';

create unique index if not exists idx_blitzpay_payment_intents_stripe_pi_unique
  on public.blitzpay_payment_intents (stripe_payment_intent_id);

create unique index if not exists idx_blitzpay_payment_intents_checkout_session_unique
  on public.blitzpay_payment_intents (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists idx_blitzpay_payment_intents_org_idempotency_unique
  on public.blitzpay_payment_intents (organization_id, idempotency_key);

create index if not exists idx_blitzpay_payment_intents_org_invoice_created
  on public.blitzpay_payment_intents (organization_id, org_invoice_id, created_at desc);

create index if not exists idx_blitzpay_payment_intents_org_status_updated
  on public.blitzpay_payment_intents (organization_id, status, updated_at desc);

-- ---------------------------------------------------------------------------
-- 3) Invoice payment attempts (sessions / user actions)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_invoice_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  org_invoice_id uuid not null references public.org_invoices (id) on delete cascade,
  blitzpay_payment_intent_id uuid references public.blitzpay_payment_intents (id) on delete set null,
  attempt_no int not null check (attempt_no >= 1),
  channel text not null
    check (channel in ('checkout', 'payment_element', 'portal_link')),
  created_by_user_id uuid references auth.users (id) on delete set null,
  portal_access_context jsonb,
  status text not null
    check (status in ('initiated', 'redirected', 'completed', 'failed', 'expired')),
  failure_code text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_blitzpay_invoice_attempts_org_invoice_attempt_no
  on public.blitzpay_invoice_payment_attempts (organization_id, org_invoice_id, attempt_no);

create index if not exists idx_blitzpay_invoice_attempts_org_invoice_created
  on public.blitzpay_invoice_payment_attempts (organization_id, org_invoice_id, created_at desc);

create index if not exists idx_blitzpay_invoice_attempts_org_status
  on public.blitzpay_invoice_payment_attempts (organization_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- 4) Immutable fee snapshot at charge creation
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_fee_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  blitzpay_payment_intent_id uuid not null references public.blitzpay_payment_intents (id) on delete cascade,
  platform_fee_bps int not null,
  platform_fee_fixed_cents int not null,
  convenience_fee_bps int not null default 0,
  convenience_fee_fixed_cents int not null default 0,
  stripe_fee_estimate_cents int,
  computed_total_application_fee_cents bigint not null,
  policy_version text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_blitzpay_fee_snapshots_one_per_pi
  on public.blitzpay_fee_snapshots (blitzpay_payment_intent_id);

create index if not exists idx_blitzpay_fee_snapshots_org_created
  on public.blitzpay_fee_snapshots (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5) Append-only technical ledger
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entry_type text not null
    check (
      entry_type in (
        'payment_captured',
        'application_fee_received',
        'refund',
        'chargeback',
        'adjustment'
      )
    ),
  amount_cents bigint not null,
  currency text not null,
  stripe_object_id text,
  blitzpay_payment_intent_id uuid references public.blitzpay_payment_intents (id) on delete set null,
  org_invoice_id uuid references public.org_invoices (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_blitzpay_ledger_org_type_stripe_object_unique
  on public.blitzpay_ledger_entries (organization_id, entry_type, stripe_object_id)
  where stripe_object_id is not null;

create index if not exists idx_blitzpay_ledger_org_created
  on public.blitzpay_ledger_entries (organization_id, created_at desc);

create index if not exists idx_blitzpay_ledger_stripe_object
  on public.blitzpay_ledger_entries (stripe_object_id)
  where stripe_object_id is not null;

-- ---------------------------------------------------------------------------
-- 6) Webhook inbox (bounded handler / DLQ path; service role only)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_webhook_inbox (
  stripe_event_id text primary key,
  event_type text not null,
  livemode boolean not null,
  stripe_connect_account text,
  payload_hash text not null,
  processing_status text not null
    check (processing_status in ('pending', 'processing', 'done', 'dead')),
  attempt_count int not null default 0 check (attempt_count >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_blitzpay_webhook_inbox_pending_created
  on public.blitzpay_webhook_inbox (processing_status, created_at)
  where processing_status = 'pending';

-- ---------------------------------------------------------------------------
-- Grants + RLS (tenant read; no authenticated writes)
-- ---------------------------------------------------------------------------
revoke all on table public.blitzpay_org_settings from public, anon;
revoke all on table public.blitzpay_payment_intents from public, anon;
revoke all on table public.blitzpay_invoice_payment_attempts from public, anon;
revoke all on table public.blitzpay_fee_snapshots from public, anon;
revoke all on table public.blitzpay_ledger_entries from public, anon;
revoke all on table public.blitzpay_webhook_inbox from public, anon, authenticated;

grant select on table public.blitzpay_org_settings to authenticated;
grant select on table public.blitzpay_payment_intents to authenticated;
grant select on table public.blitzpay_invoice_payment_attempts to authenticated;
grant select on table public.blitzpay_fee_snapshots to authenticated;
grant select on table public.blitzpay_ledger_entries to authenticated;

alter table public.blitzpay_org_settings enable row level security;
alter table public.blitzpay_org_settings force row level security;

alter table public.blitzpay_payment_intents enable row level security;
alter table public.blitzpay_payment_intents force row level security;

alter table public.blitzpay_invoice_payment_attempts enable row level security;
alter table public.blitzpay_invoice_payment_attempts force row level security;

alter table public.blitzpay_fee_snapshots enable row level security;
alter table public.blitzpay_fee_snapshots force row level security;

alter table public.blitzpay_ledger_entries enable row level security;
alter table public.blitzpay_ledger_entries force row level security;

alter table public.blitzpay_webhook_inbox enable row level security;
alter table public.blitzpay_webhook_inbox force row level security;

drop policy if exists "blitzpay_org_settings_select_member" on public.blitzpay_org_settings;
create policy "blitzpay_org_settings_select_member"
on public.blitzpay_org_settings
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "blitzpay_payment_intents_select_member" on public.blitzpay_payment_intents;
create policy "blitzpay_payment_intents_select_member"
on public.blitzpay_payment_intents
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "blitzpay_invoice_payment_attempts_select_member" on public.blitzpay_invoice_payment_attempts;
create policy "blitzpay_invoice_payment_attempts_select_member"
on public.blitzpay_invoice_payment_attempts
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "blitzpay_fee_snapshots_select_member" on public.blitzpay_fee_snapshots;
create policy "blitzpay_fee_snapshots_select_member"
on public.blitzpay_fee_snapshots
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "blitzpay_ledger_entries_select_member" on public.blitzpay_ledger_entries;
create policy "blitzpay_ledger_entries_select_member"
on public.blitzpay_ledger_entries
for select
to authenticated
using (public.is_org_member (organization_id));
