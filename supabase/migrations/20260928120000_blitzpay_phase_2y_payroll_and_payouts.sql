-- BlitzPay Phase 2Y — payroll-style accruals, technician commissions, contractor settlements (WO-linked),
-- revenue-share rules/ledger, payroll runs (orchestration only; no ACH payroll execution).
-- NOTE: `blitzpay_vendor_payouts` already exists (Phase 2S internal AP paid marker). WO/subcontractor settlements use
-- `blitzpay_contractor_settlements` instead.

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

-- ---------------------------------------------------------------------------
-- Payroll run header (one row per org + period; status transitions in place)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_payroll_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  payroll_status text not null default 'draft'
    check (payroll_status in ('draft', 'approved', 'processing', 'completed', 'failed')),
  total_payout_cents bigint not null default 0 check (total_payout_cents >= 0),
  total_commission_cents bigint not null default 0 check (total_commission_cents >= 0),
  technician_count integer not null default 0 check (technician_count >= 0),
  processed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blitzpay_payroll_runs_org_period unique (organization_id, period_start, period_end)
);

comment on table public.blitzpay_payroll_runs is
  'Org-scoped payroll orchestration periods (draft/approve/finalize); no outbound ACH in Phase 2Y.';

create index if not exists idx_blitzpay_payroll_runs_org_status
  on public.blitzpay_payroll_runs (organization_id, payroll_status, period_end desc);

-- ---------------------------------------------------------------------------
-- Technician compensation profiles (auth.users = field technician identity)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_technician_compensation_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  technician_user_id uuid not null references auth.users (id) on delete cascade,
  compensation_type text not null
    check (compensation_type in ('hourly', 'salary', 'commission', 'hybrid')),
  commission_percentage numeric(8, 5) not null default 0 check (commission_percentage >= 0 and commission_percentage <= 100),
  flat_rate_cents bigint not null default 0 check (flat_rate_cents >= 0),
  overtime_multiplier numeric(8, 5) not null default 1 check (overtime_multiplier >= 1 and overtime_multiplier <= 5),
  active boolean not null default true,
  effective_from date not null default (now() at time zone 'utc')::date,
  effective_to date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_technician_compensation_profiles is
  'Deterministic commission / hybrid compensation inputs per technician user (no bank data).';

create index if not exists idx_blitzpay_tech_comp_org_tech
  on public.blitzpay_technician_compensation_profiles (organization_id, technician_user_id, active, effective_from desc);

-- ---------------------------------------------------------------------------
-- Work-order / invoice commission accruals (idempotent per WO+invoice+tech)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_work_order_commissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  work_order_id uuid references public.work_orders (id) on delete set null,
  org_invoice_id uuid not null references public.org_invoices (id) on delete cascade,
  technician_user_id uuid not null references auth.users (id) on delete cascade,
  revenue_basis_cents bigint not null default 0 check (revenue_basis_cents >= 0),
  commission_cents bigint not null default 0 check (commission_cents >= 0),
  commission_status text not null default 'pending'
    check (commission_status in ('pending', 'approved', 'paid', 'void')),
  payroll_run_id uuid references public.blitzpay_payroll_runs (id) on delete set null,
  calculated_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz,
  constraint blitzpay_wo_commissions_dedupe unique (organization_id, org_invoice_id, technician_user_id)
);

comment on table public.blitzpay_work_order_commissions is
  'Deterministic technician commission accruals tied to collected invoice balance (partial payments supported).';

create index if not exists idx_blitzpay_wo_commissions_org_status
  on public.blitzpay_work_order_commissions (organization_id, commission_status, calculated_at desc);

create index if not exists idx_blitzpay_wo_commissions_invoice
  on public.blitzpay_work_order_commissions (organization_id, org_invoice_id);

-- ---------------------------------------------------------------------------
-- WO-linked contractor / partner settlements (NOT Phase 2S blitzpay_vendor_payouts)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_contractor_settlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  org_vendor_id uuid references public.org_vendors (id) on delete set null,
  work_order_id uuid references public.work_orders (id) on delete set null,
  org_invoice_id uuid references public.org_invoices (id) on delete set null,
  settlement_type text not null
    check (settlement_type in ('subcontractor', 'parts_refund', 'partner_share')),
  amount_cents bigint not null check (amount_cents >= 0),
  settlement_status text not null default 'pending'
    check (settlement_status in ('pending', 'scheduled', 'paid', 'failed', 'void')),
  scheduled_for date,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_contractor_settlements is
  'Subcontractor/partner settlement accruals tied to work orders or invoices (Phase 2Y). Distinct from Phase 2S vendor AP payout markers.';

create index if not exists idx_blitzpay_contractor_settlements_org_status
  on public.blitzpay_contractor_settlements (organization_id, settlement_status, scheduled_for);

-- ---------------------------------------------------------------------------
-- Revenue share rules + ledger (deterministic allocation bookkeeping)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_revenue_share_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  rule_type text not null
    check (rule_type in ('membership', 'maintenance_plan', 'work_order', 'invoice')),
  percentage numeric(8, 5) not null check (percentage >= 0 and percentage <= 100),
  applies_to text not null default 'all',
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_revenue_share_rules is
  'Org-defined revenue share percentages by source kind (no AI; application logic in app code).';

create index if not exists idx_blitzpay_rev_share_rules_org_active
  on public.blitzpay_revenue_share_rules (organization_id, active, rule_type);

create table if not exists public.blitzpay_revenue_share_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  recipient_type text not null check (recipient_type in ('technician', 'vendor', 'partner', 'platform', 'internal')),
  recipient_id uuid,
  gross_cents bigint not null check (gross_cents >= 0),
  share_cents bigint not null check (share_cents >= 0),
  status text not null default 'pending' check (status in ('pending', 'recognized', 'void')),
  revenue_share_rule_id uuid references public.blitzpay_revenue_share_rules (id) on delete set null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint blitzpay_rev_share_ledger_idem unique (organization_id, idempotency_key)
);

comment on table public.blitzpay_revenue_share_ledger is
  'Append-style revenue share recognition rows (idempotent via idempotency_key).';

create index if not exists idx_blitzpay_rev_share_ledger_org_created
  on public.blitzpay_revenue_share_ledger (organization_id, created_at desc);

-- Triggers: updated_at
drop trigger if exists trg_blitzpay_payroll_runs_set_updated_at on public.blitzpay_payroll_runs;
create trigger trg_blitzpay_payroll_runs_set_updated_at
before update on public.blitzpay_payroll_runs
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_tech_comp_set_updated_at on public.blitzpay_technician_compensation_profiles;
create trigger trg_blitzpay_tech_comp_set_updated_at
before update on public.blitzpay_technician_compensation_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_contractor_settlements_set_updated_at on public.blitzpay_contractor_settlements;
create trigger trg_blitzpay_contractor_settlements_set_updated_at
before update on public.blitzpay_contractor_settlements
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_rev_share_rules_set_updated_at on public.blitzpay_revenue_share_rules;
create trigger trg_blitzpay_rev_share_rules_set_updated_at
before update on public.blitzpay_revenue_share_rules
for each row execute function public.set_updated_at();

-- Grants + RLS (org members SELECT only; writes via service-role APIs — same as Phase 2X ledger tables)
revoke all on table public.blitzpay_payroll_runs from public, anon;
revoke all on table public.blitzpay_technician_compensation_profiles from public, anon;
revoke all on table public.blitzpay_work_order_commissions from public, anon;
revoke all on table public.blitzpay_contractor_settlements from public, anon;
revoke all on table public.blitzpay_revenue_share_rules from public, anon;
revoke all on table public.blitzpay_revenue_share_ledger from public, anon;

grant select on table public.blitzpay_payroll_runs to authenticated;
grant select on table public.blitzpay_technician_compensation_profiles to authenticated;
grant select on table public.blitzpay_work_order_commissions to authenticated;
grant select on table public.blitzpay_contractor_settlements to authenticated;
grant select on table public.blitzpay_revenue_share_rules to authenticated;
grant select on table public.blitzpay_revenue_share_ledger to authenticated;

alter table public.blitzpay_payroll_runs enable row level security;
alter table public.blitzpay_payroll_runs force row level security;
alter table public.blitzpay_technician_compensation_profiles enable row level security;
alter table public.blitzpay_technician_compensation_profiles force row level security;
alter table public.blitzpay_work_order_commissions enable row level security;
alter table public.blitzpay_work_order_commissions force row level security;
alter table public.blitzpay_contractor_settlements enable row level security;
alter table public.blitzpay_contractor_settlements force row level security;
alter table public.blitzpay_revenue_share_rules enable row level security;
alter table public.blitzpay_revenue_share_rules force row level security;
alter table public.blitzpay_revenue_share_ledger enable row level security;
alter table public.blitzpay_revenue_share_ledger force row level security;

drop policy if exists "blitzpay_payroll_runs_select_member" on public.blitzpay_payroll_runs;
create policy "blitzpay_payroll_runs_select_member"
on public.blitzpay_payroll_runs
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "blitzpay_tech_comp_profiles_select_member" on public.blitzpay_technician_compensation_profiles;
create policy "blitzpay_tech_comp_profiles_select_member"
on public.blitzpay_technician_compensation_profiles
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "blitzpay_wo_commissions_select_member" on public.blitzpay_work_order_commissions;
create policy "blitzpay_wo_commissions_select_member"
on public.blitzpay_work_order_commissions
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "blitzpay_contractor_settlements_select_member" on public.blitzpay_contractor_settlements;
create policy "blitzpay_contractor_settlements_select_member"
on public.blitzpay_contractor_settlements
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "blitzpay_rev_share_rules_select_member" on public.blitzpay_revenue_share_rules;
create policy "blitzpay_rev_share_rules_select_member"
on public.blitzpay_revenue_share_rules
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "blitzpay_rev_share_ledger_select_member" on public.blitzpay_revenue_share_ledger;
create policy "blitzpay_rev_share_ledger_select_member"
on public.blitzpay_revenue_share_ledger
for select
to authenticated
using (public.is_org_member (organization_id));
