-- BlitzPay Phase 2Z — internal cash planning buckets, allocation ledger, reserve rules, runway snapshots.
-- No stored-money custody; Stripe Connect remains the movement source of truth. Planning / estimates only.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regprocedure('public.is_org_member(uuid)') is null then
    raise exception 'Missing dependency: public.is_org_member(uuid)';
  end if;
end;
$$;

create table if not exists public.blitzpay_cash_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_type text not null
    check (account_type in ('operating', 'reserve', 'project_hold', 'payroll_hold', 'tax_hold', 'vendor_hold')),
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  target_balance_cents bigint not null default 0 check (target_balance_cents >= 0),
  current_estimated_balance_cents bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_cash_accounts is
  'Internal planning buckets for contractor cash views (not bank accounts; no custody).';

create index if not exists idx_blitzpay_cash_accounts_org_type
  on public.blitzpay_cash_accounts (organization_id, account_type, status);

create table if not exists public.blitzpay_cash_account_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  cash_account_id uuid not null references public.blitzpay_cash_accounts (id) on delete cascade,
  source_type text not null
    check (source_type in (
      'payment', 'payout', 'refund', 'wallet_credit', 'membership_revenue',
      'payroll_reserve', 'vendor_payable'
    )),
  source_id uuid not null,
  allocation_cents bigint not null check (allocation_cents >= 0),
  allocation_status text not null default 'estimated'
    check (allocation_status in ('estimated', 'confirmed', 'released', 'reversed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_cash_account_allocations is
  'Append-style internal allocation rows for cash-bucket planning (status transitions in app).';

create index if not exists idx_blitzpay_cash_alloc_org_account
  on public.blitzpay_cash_account_allocations (organization_id, cash_account_id, created_at desc);

create table if not exists public.blitzpay_cash_reserve_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  rule_name text not null,
  rule_type text not null
    check (rule_type in (
      'percent_of_collections', 'fixed_monthly_reserve', 'payroll_liability', 'vendor_ap_pressure',
      'dispute_risk', 'tax_estimate'
    )),
  basis_points integer check (basis_points is null or (basis_points >= 0 and basis_points <= 100000)),
  fixed_amount_cents bigint check (fixed_amount_cents is null or fixed_amount_cents >= 0),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_cash_reserve_rules is
  'Deterministic reserve heuristics for internal operating-cash planning (not a bank product).';

create index if not exists idx_blitzpay_cash_reserve_rules_org_active
  on public.blitzpay_cash_reserve_rules (organization_id, active, rule_type);

create table if not exists public.blitzpay_cash_runway_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  snapshot_date date not null,
  available_cash_cents bigint not null default 0,
  expected_inflows_7d_cents bigint not null default 0 check (expected_inflows_7d_cents >= 0),
  expected_inflows_30d_cents bigint not null default 0 check (expected_inflows_30d_cents >= 0),
  expected_outflows_7d_cents bigint not null default 0 check (expected_outflows_7d_cents >= 0),
  expected_outflows_30d_cents bigint not null default 0 check (expected_outflows_30d_cents >= 0),
  reserve_target_cents bigint not null default 0 check (reserve_target_cents >= 0),
  runway_status text not null default 'healthy' check (runway_status in ('healthy', 'watch', 'risk')),
  created_at timestamptz not null default now(),
  constraint blitzpay_cash_runway_snapshots_org_day unique (organization_id, snapshot_date)
);

comment on table public.blitzpay_cash_runway_snapshots is
  'Daily internal runway snapshot (estimated available vs obligations; no Stripe money custody).';

create index if not exists idx_blitzpay_cash_runway_org_date
  on public.blitzpay_cash_runway_snapshots (organization_id, snapshot_date desc);

drop trigger if exists trg_blitzpay_cash_accounts_set_updated_at on public.blitzpay_cash_accounts;
create trigger trg_blitzpay_cash_accounts_set_updated_at
before update on public.blitzpay_cash_accounts
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_cash_alloc_set_updated_at on public.blitzpay_cash_account_allocations;
create trigger trg_blitzpay_cash_alloc_set_updated_at
before update on public.blitzpay_cash_account_allocations
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_cash_reserve_rules_set_updated_at on public.blitzpay_cash_reserve_rules;
create trigger trg_blitzpay_cash_reserve_rules_set_updated_at
before update on public.blitzpay_cash_reserve_rules
for each row execute function public.set_updated_at();

revoke all on table public.blitzpay_cash_accounts from public, anon;
revoke all on table public.blitzpay_cash_account_allocations from public, anon;
revoke all on table public.blitzpay_cash_reserve_rules from public, anon;
revoke all on table public.blitzpay_cash_runway_snapshots from public, anon;

grant select on table public.blitzpay_cash_accounts to authenticated;
grant select on table public.blitzpay_cash_account_allocations to authenticated;
grant select on table public.blitzpay_cash_reserve_rules to authenticated;
grant select on table public.blitzpay_cash_runway_snapshots to authenticated;

alter table public.blitzpay_cash_accounts enable row level security;
alter table public.blitzpay_cash_accounts force row level security;
alter table public.blitzpay_cash_account_allocations enable row level security;
alter table public.blitzpay_cash_account_allocations force row level security;
alter table public.blitzpay_cash_reserve_rules enable row level security;
alter table public.blitzpay_cash_reserve_rules force row level security;
alter table public.blitzpay_cash_runway_snapshots enable row level security;
alter table public.blitzpay_cash_runway_snapshots force row level security;

drop policy if exists "blitzpay_cash_accounts_select_member" on public.blitzpay_cash_accounts;
create policy "blitzpay_cash_accounts_select_member"
on public.blitzpay_cash_accounts
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "blitzpay_cash_allocations_select_member" on public.blitzpay_cash_account_allocations;
create policy "blitzpay_cash_allocations_select_member"
on public.blitzpay_cash_account_allocations
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "blitzpay_cash_reserve_rules_select_member" on public.blitzpay_cash_reserve_rules;
create policy "blitzpay_cash_reserve_rules_select_member"
on public.blitzpay_cash_reserve_rules
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "blitzpay_cash_runway_snapshots_select_member" on public.blitzpay_cash_runway_snapshots;
create policy "blitzpay_cash_runway_snapshots_select_member"
on public.blitzpay_cash_runway_snapshots
for select
to authenticated
using (public.is_org_member (organization_id));
