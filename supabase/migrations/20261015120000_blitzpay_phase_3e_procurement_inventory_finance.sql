-- BlitzPay Phase 3E — Procurement & inventory finance foundations (orchestration / accounting signals only).
-- No autonomous purchasing, no supplier financing custody, no inventory lending balances.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
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
-- Inventory financial items (valuation policy per SKU / catalog link)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_inventory_financial_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  inventory_item_id uuid references public.catalog_items (id) on delete set null,
  sku text,
  item_name text not null,
  item_status text not null default 'active'
    check (item_status in ('active', 'inactive', 'archived')),
  valuation_method text not null default 'weighted_average'
    check (valuation_method in ('fifo', 'weighted_average', 'standard_cost')),
  unit_cost_cents bigint not null default 0 check (unit_cost_cents >= 0),
  average_cost_cents bigint check (average_cost_cents is null or average_cost_cents >= 0),
  replacement_cost_cents bigint check (replacement_cost_cents is null or replacement_cost_cents >= 0),
  inventory_asset_account_id uuid references public.blitzpay_chart_of_accounts (id) on delete set null,
  cogs_account_id uuid references public.blitzpay_chart_of_accounts (id) on delete set null,
  revenue_account_id uuid references public.blitzpay_chart_of_accounts (id) on delete set null,
  serialized_tracking_enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_inventory_financial_items is
  'Internal inventory finance profile; deterministic valuation inputs. No portal exposure.';

create index if not exists idx_blitzpay_inv_fin_items_org_status
  on public.blitzpay_inventory_financial_items (organization_id, item_status);

create index if not exists idx_blitzpay_inv_fin_items_catalog
  on public.blitzpay_inventory_financial_items (organization_id, inventory_item_id);

-- ---------------------------------------------------------------------------
-- Inventory financial movements (append-only ledger; corrections via new rows)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_inventory_financial_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  inventory_financial_item_id uuid not null references public.blitzpay_inventory_financial_items (id) on delete cascade,
  movement_type text not null
    check (movement_type in (
      'purchase', 'adjustment', 'transfer', 'work_order_usage', 'invoice_sale',
      'return', 'writeoff', 'reconciliation'
    )),
  quantity_delta numeric(24, 6) not null,
  unit_cost_cents bigint not null check (unit_cost_cents >= 0),
  total_cost_cents bigint not null,
  linked_vendor_bill_id uuid references public.blitzpay_vendor_bills (id) on delete set null,
  linked_work_order_id uuid references public.work_orders (id) on delete set null,
  linked_invoice_id uuid references public.org_invoices (id) on delete set null,
  linked_purchase_order_id uuid references public.org_purchase_orders (id) on delete set null,
  movement_date date not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.blitzpay_inventory_financial_movements is
  'Append-only inventory cost movements; reversal model only (no destructive edits).';

create index if not exists idx_blitzpay_inv_fin_mov_org_item_date
  on public.blitzpay_inventory_financial_movements (organization_id, inventory_financial_item_id, movement_date desc, created_at desc);

create index if not exists idx_blitzpay_inv_fin_mov_org_created
  on public.blitzpay_inventory_financial_movements (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Valuation snapshots (bounded reporting aggregates)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_inventory_valuation_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  snapshot_date date not null,
  total_inventory_value_cents bigint not null default 0 check (total_inventory_value_cents >= 0),
  total_serialized_asset_value_cents bigint not null default 0 check (total_serialized_asset_value_cents >= 0),
  total_writeoff_exposure_cents bigint not null default 0 check (total_writeoff_exposure_cents >= 0),
  total_reorder_exposure_cents bigint not null default 0 check (total_reorder_exposure_cents >= 0),
  inventory_health_score integer check (inventory_health_score is null or (inventory_health_score >= 0 and inventory_health_score <= 100)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint blitzpay_inv_val_snapshots_org_date unique (organization_id, snapshot_date)
);

create index if not exists idx_blitzpay_inv_val_snapshots_org_created
  on public.blitzpay_inventory_valuation_snapshots (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Vendor rebate programs & accruals (accrual tracking only)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_vendor_rebate_programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vendor_id uuid not null references public.blitzpay_vendors (id) on delete cascade,
  program_name text not null,
  rebate_status text not null default 'active'
    check (rebate_status in ('active', 'inactive', 'expired', 'archived')),
  rebate_type text not null default 'percentage'
    check (rebate_type in ('percentage', 'volume', 'tiered', 'fixed')),
  rebate_basis_points integer check (rebate_basis_points is null or (rebate_basis_points >= 0 and rebate_basis_points <= 10000)),
  rebate_threshold_cents bigint check (rebate_threshold_cents is null or rebate_threshold_cents >= 0),
  estimated_annual_rebate_cents bigint check (estimated_annual_rebate_cents is null or estimated_annual_rebate_cents >= 0),
  effective_start_date date,
  effective_end_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_vendor_rebate_prog_org
  on public.blitzpay_vendor_rebate_programs (organization_id, rebate_status);

create table if not exists public.blitzpay_vendor_rebate_accruals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vendor_rebate_program_id uuid not null references public.blitzpay_vendor_rebate_programs (id) on delete cascade,
  accrual_status text not null default 'estimated'
    check (accrual_status in ('estimated', 'accrued', 'recognized', 'reversed')),
  accrued_amount_cents bigint not null check (accrued_amount_cents >= 0),
  linked_vendor_bill_id uuid references public.blitzpay_vendor_bills (id) on delete set null,
  accrual_date date not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_vendor_rebate_accr_org_prog
  on public.blitzpay_vendor_rebate_accruals (organization_id, vendor_rebate_program_id, accrual_date desc);

-- ---------------------------------------------------------------------------
-- Reorder forecasts (operational planning; no auto-buy)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_reorder_forecasts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  inventory_financial_item_id uuid not null references public.blitzpay_inventory_financial_items (id) on delete cascade,
  forecast_status text not null default 'active'
    check (forecast_status in ('active', 'paused', 'archived')),
  projected_reorder_date date,
  projected_reorder_quantity numeric(24, 6),
  projected_reorder_cost_cents bigint check (projected_reorder_cost_cents is null or projected_reorder_cost_cents >= 0),
  forecast_confidence_score integer check (forecast_confidence_score is null or (forecast_confidence_score >= 0 and forecast_confidence_score <= 100)),
  treasury_impact_score integer check (treasury_impact_score is null or (treasury_impact_score >= 0 and treasury_impact_score <= 100)),
  usage_velocity numeric(24, 8),
  lead_time_days integer check (lead_time_days is null or (lead_time_days >= 0 and lead_time_days <= 3650)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blitzpay_reorder_forecasts_item_unique unique (organization_id, inventory_financial_item_id)
);

create index if not exists idx_blitzpay_reorder_forecasts_org_status
  on public.blitzpay_reorder_forecasts (organization_id, forecast_status);

-- ---------------------------------------------------------------------------
-- Serialized asset financials (hashed serial references only)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_serialized_asset_financials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  inventory_financial_item_id uuid not null references public.blitzpay_inventory_financial_items (id) on delete cascade,
  serial_number_hash text not null,
  acquisition_cost_cents bigint not null check (acquisition_cost_cents >= 0),
  estimated_current_value_cents bigint check (estimated_current_value_cents is null or estimated_current_value_cents >= 0),
  depreciation_cents bigint check (depreciation_cents is null or depreciation_cents >= 0),
  linked_equipment_id uuid references public.equipment (id) on delete set null,
  linked_work_order_id uuid references public.work_orders (id) on delete set null,
  asset_status text not null default 'in_stock'
    check (asset_status in ('in_stock', 'deployed', 'sold', 'retired', 'written_off')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blitzpay_serialized_asset_hash_unique unique (organization_id, serial_number_hash)
);

create index if not exists idx_blitzpay_serialized_asset_org_item
  on public.blitzpay_serialized_asset_financials (organization_id, inventory_financial_item_id);

-- ---------------------------------------------------------------------------
-- Procurement audit log (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_procurement_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  audit_type text not null
    check (audit_type in (
      'valuation_adjusted', 'reorder_forecast_updated', 'rebate_accrued', 'serialized_asset_updated',
      'inventory_reconciled', 'procurement_review', 'manual_override'
    )),
  actor_type text not null default 'system'
    check (actor_type in ('system', 'admin', 'user')),
  actor_id uuid,
  related_entity_type text,
  related_entity_id uuid,
  audit_summary text not null,
  immutable_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.blitzpay_procurement_audit_block_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'blitzpay_procurement_audit_immutable';
end;
$$;

drop trigger if exists trg_blitzpay_procurement_audit_block_update on public.blitzpay_procurement_audit_log;
create trigger trg_blitzpay_procurement_audit_block_update
before update on public.blitzpay_procurement_audit_log
for each row execute function public.blitzpay_procurement_audit_block_mutation();

drop trigger if exists trg_blitzpay_procurement_audit_block_delete on public.blitzpay_procurement_audit_log;
create trigger trg_blitzpay_procurement_audit_block_delete
before delete on public.blitzpay_procurement_audit_log
for each row execute function public.blitzpay_procurement_audit_block_mutation();

create index if not exists idx_blitzpay_procurement_audit_org_created
  on public.blitzpay_procurement_audit_log (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists trg_blitzpay_inv_fin_items_updated on public.blitzpay_inventory_financial_items;
create trigger trg_blitzpay_inv_fin_items_updated
before update on public.blitzpay_inventory_financial_items
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_vendor_rebate_prog_updated on public.blitzpay_vendor_rebate_programs;
create trigger trg_blitzpay_vendor_rebate_prog_updated
before update on public.blitzpay_vendor_rebate_programs
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_reorder_forecasts_updated on public.blitzpay_reorder_forecasts;
create trigger trg_blitzpay_reorder_forecasts_updated
before update on public.blitzpay_reorder_forecasts
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_serialized_asset_fin_updated on public.blitzpay_serialized_asset_financials;
create trigger trg_blitzpay_serialized_asset_fin_updated
before update on public.blitzpay_serialized_asset_financials
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — owner / admin / manager (finance & ops); no customer portal routes
-- ---------------------------------------------------------------------------
revoke all on table public.blitzpay_inventory_financial_items from public, anon;
revoke all on table public.blitzpay_inventory_financial_movements from public, anon;
revoke all on table public.blitzpay_inventory_valuation_snapshots from public, anon;
revoke all on table public.blitzpay_vendor_rebate_programs from public, anon;
revoke all on table public.blitzpay_vendor_rebate_accruals from public, anon;
revoke all on table public.blitzpay_reorder_forecasts from public, anon;
revoke all on table public.blitzpay_serialized_asset_financials from public, anon;
revoke all on table public.blitzpay_procurement_audit_log from public, anon;

grant select on table public.blitzpay_inventory_financial_items to authenticated;
grant select on table public.blitzpay_inventory_financial_movements to authenticated;
grant select on table public.blitzpay_inventory_valuation_snapshots to authenticated;
grant select on table public.blitzpay_vendor_rebate_programs to authenticated;
grant select on table public.blitzpay_vendor_rebate_accruals to authenticated;
grant select on table public.blitzpay_reorder_forecasts to authenticated;
grant select on table public.blitzpay_serialized_asset_financials to authenticated;
grant select on table public.blitzpay_procurement_audit_log to authenticated;

alter table public.blitzpay_inventory_financial_items enable row level security;
alter table public.blitzpay_inventory_financial_items force row level security;
alter table public.blitzpay_inventory_financial_movements enable row level security;
alter table public.blitzpay_inventory_financial_movements force row level security;
alter table public.blitzpay_inventory_valuation_snapshots enable row level security;
alter table public.blitzpay_inventory_valuation_snapshots force row level security;
alter table public.blitzpay_vendor_rebate_programs enable row level security;
alter table public.blitzpay_vendor_rebate_programs force row level security;
alter table public.blitzpay_vendor_rebate_accruals enable row level security;
alter table public.blitzpay_vendor_rebate_accruals force row level security;
alter table public.blitzpay_reorder_forecasts enable row level security;
alter table public.blitzpay_reorder_forecasts force row level security;
alter table public.blitzpay_serialized_asset_financials enable row level security;
alter table public.blitzpay_serialized_asset_financials force row level security;
alter table public.blitzpay_procurement_audit_log enable row level security;
alter table public.blitzpay_procurement_audit_log force row level security;

drop policy if exists "blitzpay_inv_fin_items_select_finance_roles" on public.blitzpay_inventory_financial_items;
create policy "blitzpay_inv_fin_items_select_finance_roles"
on public.blitzpay_inventory_financial_items
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_inv_fin_mov_select_finance_roles" on public.blitzpay_inventory_financial_movements;
create policy "blitzpay_inv_fin_mov_select_finance_roles"
on public.blitzpay_inventory_financial_movements
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_inv_val_snapshots_select_finance_roles" on public.blitzpay_inventory_valuation_snapshots;
create policy "blitzpay_inv_val_snapshots_select_finance_roles"
on public.blitzpay_inventory_valuation_snapshots
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_vendor_rebate_prog_select_finance_roles" on public.blitzpay_vendor_rebate_programs;
create policy "blitzpay_vendor_rebate_prog_select_finance_roles"
on public.blitzpay_vendor_rebate_programs
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_vendor_rebate_accr_select_finance_roles" on public.blitzpay_vendor_rebate_accruals;
create policy "blitzpay_vendor_rebate_accr_select_finance_roles"
on public.blitzpay_vendor_rebate_accruals
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_reorder_forecasts_select_finance_roles" on public.blitzpay_reorder_forecasts;
create policy "blitzpay_reorder_forecasts_select_finance_roles"
on public.blitzpay_reorder_forecasts
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_serialized_asset_fin_select_finance_roles" on public.blitzpay_serialized_asset_financials;
create policy "blitzpay_serialized_asset_fin_select_finance_roles"
on public.blitzpay_serialized_asset_financials
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_procurement_audit_select_finance_roles" on public.blitzpay_procurement_audit_log;
create policy "blitzpay_procurement_audit_select_finance_roles"
on public.blitzpay_procurement_audit_log
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));
