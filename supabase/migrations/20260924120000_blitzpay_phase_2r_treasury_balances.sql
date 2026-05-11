-- BlitzPay Phase 2R — contractor balance modeling, treasury snapshots, reserve / instant-payout interest flags.

-- ---------------------------------------------------------------------------
-- 1) Org-level treasury preferences (no bank storage; Stripe-safe knobs only)
-- ---------------------------------------------------------------------------
alter table public.blitzpay_org_settings
  add column if not exists blitzpay_reserve_target_cents bigint not null default 0
    check (blitzpay_reserve_target_cents >= 0);

alter table public.blitzpay_org_settings
  add column if not exists blitzpay_instant_payout_interest boolean not null default false;

comment on column public.blitzpay_org_settings.blitzpay_reserve_target_cents is
  'Staff-configured cash reserve target (cents) for treasury-style reporting; funds remain at Stripe.';

comment on column public.blitzpay_org_settings.blitzpay_instant_payout_interest is
  'Org opted in to instant/same-day payout products when Stripe makes them available (reporting only).';

-- ---------------------------------------------------------------------------
-- 2) Latest derived contractor balance row per org (upserted from ledger + payouts)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_org_balances (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  available_balance_cents bigint not null default 0,
  pending_balance_cents bigint not null default 0,
  held_reserve_cents bigint not null default 0,
  reserve_target_cents bigint not null default 0,
  operating_balance_cents bigint not null default 0,
  payout_in_transit_cents bigint not null default 0,
  pending_payout_total_cents bigint not null default 0,
  failed_payout_count_30d int not null default 0 check (failed_payout_count_30d >= 0),
  avg_payout_delay_days numeric(12, 4),
  payout_velocity_paid_cents_7d bigint not null default 0,
  payout_velocity_paid_cents_30d bigint not null default 0,
  instant_transfer_eligible boolean not null default false,
  payout_speed_lane text not null default 'standard'
    check (payout_speed_lane in ('standard', 'accelerated', 'unknown')),
  computed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_org_balances is
  'Derived contractor balance / payout aggregates from Stripe Connect mirror tables; staff visibility; no custody.';

create index if not exists idx_blitzpay_org_balances_computed
  on public.blitzpay_org_balances (computed_at desc);

-- ---------------------------------------------------------------------------
-- 3) Point-in-time snapshots for velocity / drift diagnostics
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  captured_at timestamptz not null default now(),
  available_balance_cents bigint not null default 0,
  pending_balance_cents bigint not null default 0,
  held_reserve_cents bigint not null default 0,
  payout_in_transit_cents bigint not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.blitzpay_balance_snapshots is
  'Append-only balance snapshots (Stripe-derived aggregates) for treasury reporting; max ~1/day per org in app logic.';

create index if not exists idx_blitzpay_balance_snapshots_org_captured
  on public.blitzpay_balance_snapshots (organization_id, captured_at desc);

-- ---------------------------------------------------------------------------
-- Grants + RLS (reads for org members; writes via service role only)
-- ---------------------------------------------------------------------------
revoke all on table public.blitzpay_org_balances from public, anon;
revoke all on table public.blitzpay_balance_snapshots from public, anon;

grant select on table public.blitzpay_org_balances to authenticated;
grant select on table public.blitzpay_balance_snapshots to authenticated;

alter table public.blitzpay_org_balances enable row level security;
alter table public.blitzpay_org_balances force row level security;

alter table public.blitzpay_balance_snapshots enable row level security;
alter table public.blitzpay_balance_snapshots force row level security;

drop policy if exists "blitzpay_org_balances_select_member" on public.blitzpay_org_balances;
create policy "blitzpay_org_balances_select_member"
on public.blitzpay_org_balances
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "blitzpay_balance_snapshots_select_member" on public.blitzpay_balance_snapshots;
create policy "blitzpay_balance_snapshots_select_member"
on public.blitzpay_balance_snapshots
for select
to authenticated
using (public.is_org_member (organization_id));
