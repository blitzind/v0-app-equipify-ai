-- BlitzPay Phase 3B — Native AP automation & bill pay foundations (orchestration only; no autonomous money movement).
-- Org-scoped vendors, vendor bills, approval flows, payment runs & allocations, aging snapshots, append-only audit.
-- RLS: owner/admin/manager read; writes via service-role Route Handlers only.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regclass('public.blitzpay_chart_of_accounts') is null then
    raise exception 'Missing dependency: public.blitzpay_chart_of_accounts (Phase 3A GL)';
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
-- Vendors (BlitzPay AP profile; distinct from org_vendors operational records)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vendor_name text not null,
  vendor_code text,
  vendor_status text not null default 'active'
    check (vendor_status in ('active', 'inactive', 'on_hold', 'archived')),
  vendor_type text not null default 'supplier'
    check (vendor_type in ('supplier', 'subcontractor', 'utility', 'payroll_partner', 'tax_agency', 'miscellaneous')),
  contact_name text,
  email text,
  phone text,
  address text,
  default_expense_account_id uuid references public.blitzpay_chart_of_accounts (id) on delete set null,
  default_ap_account_id uuid references public.blitzpay_chart_of_accounts (id) on delete set null,
  payment_terms_days integer not null default 30 check (payment_terms_days >= 0 and payment_terms_days <= 3650),
  preferred_payment_method text not null default 'ach'
    check (preferred_payment_method in ('ach', 'check', 'card', 'wire', 'external')),
  tax_identifier_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blitzpay_vendors_org_code_unique unique (organization_id, vendor_code)
);

comment on table public.blitzpay_vendors is
  'BlitzPay AP vendor master; orchestration metadata only — no autonomous payouts.';

create index if not exists idx_blitzpay_vendors_org_status
  on public.blitzpay_vendors (organization_id, vendor_status);

-- ---------------------------------------------------------------------------
-- Vendor bills
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_vendor_bills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vendor_id uuid not null references public.blitzpay_vendors (id) on delete restrict,
  bill_number text not null,
  bill_status text not null default 'draft'
    check (bill_status in (
      'draft', 'pending_approval', 'approved', 'scheduled', 'partially_paid', 'paid', 'disputed', 'voided'
    )),
  bill_date date not null,
  due_date date not null,
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  total_cents bigint not null default 0 check (total_cents >= 0),
  remaining_balance_cents bigint not null default 0 check (remaining_balance_cents >= 0),
  currency text not null default 'usd',
  linked_purchase_order_id uuid references public.org_purchase_orders (id) on delete set null,
  linked_work_order_id uuid references public.work_orders (id) on delete set null,
  linked_invoice_id uuid references public.org_invoices (id) on delete set null,
  source_type text not null default 'manual'
    check (source_type in ('manual', 'imported', 'emailed', 'integration')),
  external_reference_hash text,
  approval_required boolean not null default false,
  approved_at timestamptz,
  approved_by uuid,
  memo text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blitzpay_vendor_bills_org_vendor_bill unique (organization_id, vendor_id, bill_number),
  constraint blitzpay_vendor_bills_remaining_lte_total check (remaining_balance_cents <= total_cents)
);

comment on table public.blitzpay_vendor_bills is
  'Vendor bill lifecycle; paid rows are financially immutable (trigger).';

create index if not exists idx_blitzpay_vendor_bills_org_status_due
  on public.blitzpay_vendor_bills (organization_id, bill_status, due_date);

create index if not exists idx_blitzpay_vendor_bills_org_vendor
  on public.blitzpay_vendor_bills (organization_id, vendor_id);

-- ---------------------------------------------------------------------------
-- Vendor bill lines
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_vendor_bill_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vendor_bill_id uuid not null references public.blitzpay_vendor_bills (id) on delete cascade,
  expense_account_id uuid not null references public.blitzpay_chart_of_accounts (id) on delete restrict,
  description text,
  quantity numeric(18, 6) not null default 1 check (quantity >= 0),
  unit_cost_cents bigint not null default 0 check (unit_cost_cents >= 0),
  line_total_cents bigint not null check (line_total_cents >= 0),
  linked_equipment_id uuid references public.equipment (id) on delete set null,
  linked_work_order_id uuid references public.work_orders (id) on delete set null,
  linked_inventory_item_id uuid references public.catalog_items (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_vendor_bill_lines_org_bill
  on public.blitzpay_vendor_bill_lines (organization_id, vendor_bill_id);

-- ---------------------------------------------------------------------------
-- AP payment runs (orchestration queue — does not transmit funds)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_ap_payment_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  run_reference text not null,
  run_status text not null default 'draft'
    check (run_status in ('draft', 'scheduled', 'processing', 'completed', 'canceled')),
  scheduled_for timestamptz,
  total_bills integer not null default 0 check (total_bills >= 0),
  total_amount_cents bigint not null default 0 check (total_amount_cents >= 0),
  treasury_health_status text,
  created_by uuid,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blitzpay_ap_payment_runs_org_ref unique (organization_id, run_reference)
);

create index if not exists idx_blitzpay_ap_payment_runs_org_status
  on public.blitzpay_ap_payment_runs (organization_id, run_status, scheduled_for);

-- ---------------------------------------------------------------------------
-- Allocations (planned vendor application of cash — no Stripe payout automation here)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_ap_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  payment_run_id uuid references public.blitzpay_ap_payment_runs (id) on delete set null,
  vendor_bill_id uuid not null references public.blitzpay_vendor_bills (id) on delete restrict,
  allocation_status text not null default 'scheduled'
    check (allocation_status in ('scheduled', 'processing', 'completed', 'failed', 'reversed')),
  allocated_amount_cents bigint not null check (allocated_amount_cents > 0),
  remaining_bill_balance_cents bigint not null check (remaining_bill_balance_cents >= 0),
  provider text not null default 'external'
    check (provider in ('stripe', 'external', 'manual')),
  provider_reference_hash text,
  allocated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_ap_alloc_org_bill
  on public.blitzpay_ap_payment_allocations (organization_id, vendor_bill_id);

create index if not exists idx_blitzpay_ap_alloc_org_run
  on public.blitzpay_ap_payment_allocations (organization_id, payment_run_id);

-- ---------------------------------------------------------------------------
-- Approval routing (single active row per bill)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_ap_approval_flows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vendor_bill_id uuid not null references public.blitzpay_vendor_bills (id) on delete cascade,
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected', 'escalated')),
  current_stage integer not null default 0 check (current_stage >= 0),
  max_stage integer not null default 1 check (max_stage >= 0),
  assigned_approver uuid,
  approved_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blitzpay_ap_approval_flows_bill_unique unique (vendor_bill_id)
);

create index if not exists idx_blitzpay_ap_approval_org_status
  on public.blitzpay_ap_approval_flows (organization_id, approval_status);

-- ---------------------------------------------------------------------------
-- Vendor aging snapshots (materialized aggregates; bounded writes from app)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_vendor_aging_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vendor_id uuid not null references public.blitzpay_vendors (id) on delete cascade,
  snapshot_date date not null,
  current_due_cents bigint not null default 0 check (current_due_cents >= 0),
  days_30_cents bigint not null default 0 check (days_30_cents >= 0),
  days_60_cents bigint not null default 0 check (days_60_cents >= 0),
  days_90_cents bigint not null default 0 check (days_90_cents >= 0),
  days_120_plus_cents bigint not null default 0 check (days_120_plus_cents >= 0),
  total_outstanding_cents bigint not null default 0 check (total_outstanding_cents >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint blitzpay_vendor_aging_org_vendor_day unique (organization_id, vendor_id, snapshot_date)
);

create index if not exists idx_blitzpay_vendor_aging_org_day
  on public.blitzpay_vendor_aging_snapshots (organization_id, snapshot_date desc);

-- ---------------------------------------------------------------------------
-- Append-only audit events
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_ap_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  action text not null,
  vendor_bill_id uuid references public.blitzpay_vendor_bills (id) on delete set null,
  payment_run_id uuid references public.blitzpay_ap_payment_runs (id) on delete set null,
  actor_user_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_ap_audit_org_created
  on public.blitzpay_ap_audit_events (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Immutability: paid vendor bills — block financial field changes
-- ---------------------------------------------------------------------------
create or replace function public.blitzpay_vendor_bills_block_paid_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.bill_status = 'paid' then
    if new.bill_status is distinct from old.bill_status
         or new.total_cents is distinct from old.total_cents
         or new.subtotal_cents is distinct from old.subtotal_cents
         or new.tax_cents is distinct from old.tax_cents
         or new.remaining_balance_cents is distinct from old.remaining_balance_cents
         or new.vendor_id is distinct from old.vendor_id
         or new.bill_number is distinct from old.bill_number
         or new.bill_date is distinct from old.bill_date
         or new.due_date is distinct from old.due_date
         or new.currency is distinct from old.currency
      then
      raise exception 'blitzpay_vendor_bills_paid_immutable';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_blitzpay_vendor_bills_paid_guard on public.blitzpay_vendor_bills;
create trigger trg_blitzpay_vendor_bills_paid_guard
before update on public.blitzpay_vendor_bills
for each row execute function public.blitzpay_vendor_bills_block_paid_mutation();

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
drop trigger if exists trg_blitzpay_vendors_updated on public.blitzpay_vendors;
create trigger trg_blitzpay_vendors_updated
before update on public.blitzpay_vendors
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_vendor_bills_updated on public.blitzpay_vendor_bills;
create trigger trg_blitzpay_vendor_bills_updated
before update on public.blitzpay_vendor_bills
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_ap_payment_runs_updated on public.blitzpay_ap_payment_runs;
create trigger trg_blitzpay_ap_payment_runs_updated
before update on public.blitzpay_ap_payment_runs
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_ap_approval_flows_updated on public.blitzpay_ap_approval_flows;
create trigger trg_blitzpay_ap_approval_flows_updated
before update on public.blitzpay_ap_approval_flows
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
revoke all on table public.blitzpay_vendors from public, anon;
revoke all on table public.blitzpay_vendor_bills from public, anon;
revoke all on table public.blitzpay_vendor_bill_lines from public, anon;
revoke all on table public.blitzpay_ap_payment_runs from public, anon;
revoke all on table public.blitzpay_ap_payment_allocations from public, anon;
revoke all on table public.blitzpay_ap_approval_flows from public, anon;
revoke all on table public.blitzpay_vendor_aging_snapshots from public, anon;
revoke all on table public.blitzpay_ap_audit_events from public, anon;

grant select on table public.blitzpay_vendors to authenticated;
grant select on table public.blitzpay_vendor_bills to authenticated;
grant select on table public.blitzpay_vendor_bill_lines to authenticated;
grant select on table public.blitzpay_ap_payment_runs to authenticated;
grant select on table public.blitzpay_ap_payment_allocations to authenticated;
grant select on table public.blitzpay_ap_approval_flows to authenticated;
grant select on table public.blitzpay_vendor_aging_snapshots to authenticated;
grant select on table public.blitzpay_ap_audit_events to authenticated;

alter table public.blitzpay_vendors enable row level security;
alter table public.blitzpay_vendors force row level security;
alter table public.blitzpay_vendor_bills enable row level security;
alter table public.blitzpay_vendor_bills force row level security;
alter table public.blitzpay_vendor_bill_lines enable row level security;
alter table public.blitzpay_vendor_bill_lines force row level security;
alter table public.blitzpay_ap_payment_runs enable row level security;
alter table public.blitzpay_ap_payment_runs force row level security;
alter table public.blitzpay_ap_payment_allocations enable row level security;
alter table public.blitzpay_ap_payment_allocations force row level security;
alter table public.blitzpay_ap_approval_flows enable row level security;
alter table public.blitzpay_ap_approval_flows force row level security;
alter table public.blitzpay_vendor_aging_snapshots enable row level security;
alter table public.blitzpay_vendor_aging_snapshots force row level security;
alter table public.blitzpay_ap_audit_events enable row level security;
alter table public.blitzpay_ap_audit_events force row level security;

drop policy if exists "blitzpay_vendors_select_finance_roles" on public.blitzpay_vendors;
create policy "blitzpay_vendors_select_finance_roles"
on public.blitzpay_vendors
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_vendor_bills_select_finance_roles" on public.blitzpay_vendor_bills;
create policy "blitzpay_vendor_bills_select_finance_roles"
on public.blitzpay_vendor_bills
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_vendor_bill_lines_select_finance_roles" on public.blitzpay_vendor_bill_lines;
create policy "blitzpay_vendor_bill_lines_select_finance_roles"
on public.blitzpay_vendor_bill_lines
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_ap_payment_runs_select_finance_roles" on public.blitzpay_ap_payment_runs;
create policy "blitzpay_ap_payment_runs_select_finance_roles"
on public.blitzpay_ap_payment_runs
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_ap_alloc_select_finance_roles" on public.blitzpay_ap_payment_allocations;
create policy "blitzpay_ap_alloc_select_finance_roles"
on public.blitzpay_ap_payment_allocations
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_ap_approval_select_finance_roles" on public.blitzpay_ap_approval_flows;
create policy "blitzpay_ap_approval_select_finance_roles"
on public.blitzpay_ap_approval_flows
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_vendor_aging_select_finance_roles" on public.blitzpay_vendor_aging_snapshots;
create policy "blitzpay_vendor_aging_select_finance_roles"
on public.blitzpay_vendor_aging_snapshots
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_ap_audit_select_finance_roles" on public.blitzpay_ap_audit_events;
create policy "blitzpay_ap_audit_select_finance_roles"
on public.blitzpay_ap_audit_events
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));
