-- BlitzPay Phase 5C — Embedded insurance, warranty & claims foundations (orchestration only; no underwriting; no autonomous payouts).
-- Org-scoped RLS; finance roles; append-only claims audit.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regclass('public.blitzpay_chart_of_accounts') is null then
    raise exception 'Missing dependency: public.blitzpay_chart_of_accounts (Phase 3A)';
  end if;
  if to_regprocedure('public.has_org_role(uuid, text[])') is null then
    raise exception 'Missing dependency: public.has_org_role(uuid, text[])';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'Missing dependency: public.set_updated_at()';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Warranty reserves (accounting visibility; no autonomous balancing)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_warranty_reserves (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reserve_status text not null default 'active'
    check (reserve_status in ('active', 'inactive', 'archived')),
  reserve_type text not null
    check (reserve_type in ('workmanship', 'equipment', 'parts', 'labor', 'storm_response', 'custom')),
  reserve_name text not null,
  reserve_balance_cents bigint not null default 0 check (reserve_balance_cents >= 0),
  projected_exposure_cents bigint check (projected_exposure_cents is null or projected_exposure_cents >= 0),
  reserve_utilization_rate integer
    check (reserve_utilization_rate is null or (reserve_utilization_rate >= 0 and reserve_utilization_rate <= 10000)),
  linked_account_id uuid references public.blitzpay_chart_of_accounts (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_warranty_reserves is
  'Warranty reserve tracking rows; orchestration only — no automatic GL postings from BlitzPay in Phase 5C.';

create index if not exists idx_blitzpay_warranty_reserves_org
  on public.blitzpay_warranty_reserves (organization_id, reserve_status);

-- ---------------------------------------------------------------------------
-- Claims (workflow orchestration; no autonomous adjudication)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_claims (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  equipment_id uuid references public.equipment (id) on delete set null,
  linked_invoice_id uuid references public.org_invoices (id) on delete set null,
  linked_work_order_id uuid references public.work_orders (id) on delete set null,
  claim_status text not null default 'draft'
    check (claim_status in (
      'draft', 'submitted', 'reviewing', 'approved', 'partially_approved', 'denied', 'settled', 'archived'
    )),
  claim_type text not null
    check (claim_type in (
      'warranty', 'storm', 'equipment_failure', 'protection_plan', 'insurance', 'reimbursement', 'custom'
    )),
  claim_reference text not null,
  estimated_claim_amount_cents bigint check (estimated_claim_amount_cents is null or estimated_claim_amount_cents >= 0),
  approved_claim_amount_cents bigint check (approved_claim_amount_cents is null or approved_claim_amount_cents >= 0),
  payout_amount_cents bigint check (payout_amount_cents is null or payout_amount_cents >= 0),
  deductible_amount_cents bigint check (deductible_amount_cents is null or deductible_amount_cents >= 0),
  claim_event_date date,
  submitted_at timestamptz,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_claims_org_status
  on public.blitzpay_claims (organization_id, claim_status);

create index if not exists idx_blitzpay_claims_org_created
  on public.blitzpay_claims (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Reserve movements (ledger-style visibility; integer cents)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_claim_reserve_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  warranty_reserve_id uuid references public.blitzpay_warranty_reserves (id) on delete set null,
  claim_id uuid references public.blitzpay_claims (id) on delete set null,
  movement_type text not null
    check (movement_type in ('accrual', 'adjustment', 'utilization', 'reversal', 'replenishment')),
  movement_amount_cents bigint not null,
  resulting_balance_cents bigint check (resulting_balance_cents is null or resulting_balance_cents >= 0),
  movement_date date not null default (timezone('utc', now()))::date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint blitzpay_claim_reserve_movement_ref check (warranty_reserve_id is not null or claim_id is not null)
);

create index if not exists idx_blitzpay_claim_reserve_mov_org
  on public.blitzpay_claim_reserve_movements (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Equipment protection plans (operational tracking only)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_equipment_protection_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  equipment_id uuid references public.equipment (id) on delete set null,
  plan_status text not null default 'active'
    check (plan_status in ('active', 'expired', 'canceled', 'archived')),
  plan_type text not null
    check (plan_type in (
      'labor_protection', 'equipment_protection', 'maintenance_bundle', 'extended_coverage', 'storm_protection', 'custom'
    )),
  coverage_start_date date,
  coverage_end_date date,
  monthly_price_cents bigint check (monthly_price_cents is null or monthly_price_cents >= 0),
  deductible_amount_cents bigint check (deductible_amount_cents is null or deductible_amount_cents >= 0),
  estimated_exposure_cents bigint check (estimated_exposure_cents is null or estimated_exposure_cents >= 0),
  linked_membership_id uuid references public.blitzpay_memberships (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_protection_plans_org
  on public.blitzpay_equipment_protection_plans (organization_id, plan_status);

-- ---------------------------------------------------------------------------
-- Claims payout tracking (orchestration only; no fund movement)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_claims_payout_tracking (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  claim_id uuid not null references public.blitzpay_claims (id) on delete cascade,
  payout_status text not null default 'pending'
    check (payout_status in ('pending', 'scheduled', 'processing', 'completed', 'reversed', 'canceled')),
  payout_type text not null
    check (payout_type in ('reimbursement', 'vendor_payment', 'customer_credit', 'warranty_offset', 'custom')),
  payout_amount_cents bigint not null check (payout_amount_cents >= 0),
  payout_reference_hash text,
  payout_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_claims_payout_org
  on public.blitzpay_claims_payout_tracking (organization_id, payout_status);

create index if not exists idx_blitzpay_claims_payout_claim
  on public.blitzpay_claims_payout_tracking (claim_id);

-- ---------------------------------------------------------------------------
-- Storm event financials (forecasting / orchestration only)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_storm_event_financials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  event_status text not null default 'active'
    check (event_status in ('active', 'monitoring', 'completed', 'archived')),
  event_name text not null,
  event_region text,
  estimated_revenue_opportunity_cents bigint check (estimated_revenue_opportunity_cents is null or estimated_revenue_opportunity_cents >= 0),
  estimated_claim_exposure_cents bigint check (estimated_claim_exposure_cents is null or estimated_claim_exposure_cents >= 0),
  estimated_response_cost_cents bigint check (estimated_response_cost_cents is null or estimated_response_cost_cents >= 0),
  estimated_treasury_pressure integer
    check (estimated_treasury_pressure is null or (estimated_treasury_pressure >= 0 and estimated_treasury_pressure <= 100)),
  event_start_date date,
  event_end_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_storm_events_org
  on public.blitzpay_storm_event_financials (organization_id, event_status);

-- ---------------------------------------------------------------------------
-- Claims audit log (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_claims_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  claim_id uuid references public.blitzpay_claims (id) on delete set null,
  audit_type text not null
    check (audit_type in (
      'claim_created', 'claim_submitted', 'reserve_adjusted', 'payout_scheduled', 'payout_completed',
      'protection_plan_created', 'storm_event_created', 'manual_override'
    )),
  actor_type text not null check (actor_type in ('system', 'admin', 'user')),
  actor_id uuid,
  audit_summary text not null,
  immutable_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_claims_audit_org
  on public.blitzpay_claims_audit_log (organization_id, created_at desc);

create or replace function public.blitzpay_claims_audit_block_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'blitzpay_claims_audit_immutable';
end;
$$;

drop trigger if exists trg_blitzpay_claims_audit_block_update on public.blitzpay_claims_audit_log;
create trigger trg_blitzpay_claims_audit_block_update
before update on public.blitzpay_claims_audit_log
for each row execute function public.blitzpay_claims_audit_block_mutation();

drop trigger if exists trg_blitzpay_claims_audit_block_delete on public.blitzpay_claims_audit_log;
create trigger trg_blitzpay_claims_audit_block_delete
before delete on public.blitzpay_claims_audit_log
for each row execute function public.blitzpay_claims_audit_block_mutation();

-- ---------------------------------------------------------------------------
-- Protection plan reporting snapshots
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_protection_plan_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  snapshot_date date not null,
  active_plan_count integer not null default 0 check (active_plan_count >= 0),
  projected_exposure_cents bigint not null default 0 check (projected_exposure_cents >= 0),
  projected_recurring_revenue_cents bigint not null default 0 check (projected_recurring_revenue_cents >= 0),
  claim_utilization_cents bigint not null default 0 check (claim_utilization_cents >= 0),
  reserve_coverage_score integer
    check (reserve_coverage_score is null or (reserve_coverage_score >= 0 and reserve_coverage_score <= 100)),
  protection_plan_health_score integer
    check (protection_plan_health_score is null or (protection_plan_health_score >= 0 and protection_plan_health_score <= 100)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_protection_snapshots_org
  on public.blitzpay_protection_plan_snapshots (organization_id, snapshot_date desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists trg_blitzpay_warranty_reserves_updated on public.blitzpay_warranty_reserves;
create trigger trg_blitzpay_warranty_reserves_updated
before update on public.blitzpay_warranty_reserves
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_claims_updated on public.blitzpay_claims;
create trigger trg_blitzpay_claims_updated
before update on public.blitzpay_claims
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_protection_plans_updated on public.blitzpay_equipment_protection_plans;
create trigger trg_blitzpay_protection_plans_updated
before update on public.blitzpay_equipment_protection_plans
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_claims_payout_updated on public.blitzpay_claims_payout_tracking;
create trigger trg_blitzpay_claims_payout_updated
before update on public.blitzpay_claims_payout_tracking
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_storm_events_updated on public.blitzpay_storm_event_financials;
create trigger trg_blitzpay_storm_events_updated
before update on public.blitzpay_storm_event_financials
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS (org-scoped; finance roles)
-- ---------------------------------------------------------------------------
revoke all on table public.blitzpay_warranty_reserves from public, anon;
revoke all on table public.blitzpay_claims from public, anon;
revoke all on table public.blitzpay_claim_reserve_movements from public, anon;
revoke all on table public.blitzpay_equipment_protection_plans from public, anon;
revoke all on table public.blitzpay_claims_payout_tracking from public, anon;
revoke all on table public.blitzpay_storm_event_financials from public, anon;
revoke all on table public.blitzpay_claims_audit_log from public, anon;
revoke all on table public.blitzpay_protection_plan_snapshots from public, anon;

grant select on table public.blitzpay_warranty_reserves to authenticated;
grant select on table public.blitzpay_claims to authenticated;
grant select on table public.blitzpay_claim_reserve_movements to authenticated;
grant select on table public.blitzpay_equipment_protection_plans to authenticated;
grant select on table public.blitzpay_claims_payout_tracking to authenticated;
grant select on table public.blitzpay_storm_event_financials to authenticated;
grant select on table public.blitzpay_claims_audit_log to authenticated;
grant select on table public.blitzpay_protection_plan_snapshots to authenticated;

alter table public.blitzpay_warranty_reserves enable row level security;
alter table public.blitzpay_warranty_reserves force row level security;
alter table public.blitzpay_claims enable row level security;
alter table public.blitzpay_claims force row level security;
alter table public.blitzpay_claim_reserve_movements enable row level security;
alter table public.blitzpay_claim_reserve_movements force row level security;
alter table public.blitzpay_equipment_protection_plans enable row level security;
alter table public.blitzpay_equipment_protection_plans force row level security;
alter table public.blitzpay_claims_payout_tracking enable row level security;
alter table public.blitzpay_claims_payout_tracking force row level security;
alter table public.blitzpay_storm_event_financials enable row level security;
alter table public.blitzpay_storm_event_financials force row level security;
alter table public.blitzpay_claims_audit_log enable row level security;
alter table public.blitzpay_claims_audit_log force row level security;
alter table public.blitzpay_protection_plan_snapshots enable row level security;
alter table public.blitzpay_protection_plan_snapshots force row level security;

drop policy if exists "blitzpay_warranty_reserves_select_finance" on public.blitzpay_warranty_reserves;
create policy "blitzpay_warranty_reserves_select_finance"
on public.blitzpay_warranty_reserves for select to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_claims_select_finance" on public.blitzpay_claims;
create policy "blitzpay_claims_select_finance"
on public.blitzpay_claims for select to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_claim_reserve_mov_select_finance" on public.blitzpay_claim_reserve_movements;
create policy "blitzpay_claim_reserve_mov_select_finance"
on public.blitzpay_claim_reserve_movements for select to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_protection_plans_select_finance" on public.blitzpay_equipment_protection_plans;
create policy "blitzpay_protection_plans_select_finance"
on public.blitzpay_equipment_protection_plans for select to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_claims_payout_select_finance" on public.blitzpay_claims_payout_tracking;
create policy "blitzpay_claims_payout_select_finance"
on public.blitzpay_claims_payout_tracking for select to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_storm_events_select_finance" on public.blitzpay_storm_event_financials;
create policy "blitzpay_storm_events_select_finance"
on public.blitzpay_storm_event_financials for select to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_claims_audit_select_finance" on public.blitzpay_claims_audit_log;
create policy "blitzpay_claims_audit_select_finance"
on public.blitzpay_claims_audit_log for select to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_protection_snapshots_select_finance" on public.blitzpay_protection_plan_snapshots;
create policy "blitzpay_protection_snapshots_select_finance"
on public.blitzpay_protection_plan_snapshots for select to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));
