-- Inventory & parts tracking: locations, per-location stock, ledger transactions, technician van assignment.

-- -----------------------------------------------------------------------------
-- inventory_locations: warehouses, vehicles, staging, etc.
-- -----------------------------------------------------------------------------

create table if not exists public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  code text,
  location_type text not null default 'warehouse'
    check (location_type in ('warehouse', 'vehicle', 'job_site', 'staging', 'other')),
  technician_id uuid references public.technicians (id) on delete set null,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inventory_locations_org_active
  on public.inventory_locations (organization_id, is_active);

create index if not exists idx_inventory_locations_org_type
  on public.inventory_locations (organization_id, location_type);

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_inventory_locations_set_updated_at on public.inventory_locations;
    create trigger trg_inventory_locations_set_updated_at
    before update on public.inventory_locations
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

comment on table public.inventory_locations is
  'Org-scoped stock locations (warehouse, technician vehicle, job site bin).';

-- -----------------------------------------------------------------------------
-- inventory_stock: on-hand and allocated quantities per catalog line per location.
-- -----------------------------------------------------------------------------

create table if not exists public.inventory_stock (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  catalog_item_id uuid not null references public.catalog_items (id) on delete restrict,
  location_id uuid not null references public.inventory_locations (id) on delete cascade,
  quantity_on_hand numeric(14, 4) not null default 0 check (quantity_on_hand >= 0),
  quantity_allocated numeric(14, 4) not null default 0 check (quantity_allocated >= 0),
  reorder_point numeric(14, 4),
  reorder_quantity numeric(14, 4),
  updated_at timestamptz not null default now(),
  constraint inventory_stock_org_catalog_location_unique unique (organization_id, catalog_item_id, location_id),
  constraint inventory_stock_allocated_lte_on_hand check (quantity_allocated <= quantity_on_hand)
);

create index if not exists idx_inventory_stock_org_location
  on public.inventory_stock (organization_id, location_id);

create index if not exists idx_inventory_stock_org_catalog
  on public.inventory_stock (organization_id, catalog_item_id);

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_inventory_stock_set_updated_at on public.inventory_stock;
    create trigger trg_inventory_stock_set_updated_at
    before update on public.inventory_stock
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

comment on table public.inventory_stock is
  'Per-location quantities; available = on_hand - allocated. Reorder thresholds optional per SKU/location.';

-- -----------------------------------------------------------------------------
-- inventory_transactions: immutable ledger (consume, transfer, adjust, receive, …).
-- -----------------------------------------------------------------------------

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  catalog_item_id uuid not null references public.catalog_items (id) on delete restrict,
  location_id uuid not null references public.inventory_locations (id) on delete restrict,
  transaction_type text not null
    check (
      transaction_type in (
        'adjustment',
        'transfer_in',
        'transfer_out',
        'consume',
        'receive',
        'allocate',
        'deallocate',
        'reorder_recorded'
      )
    ),
  delta_on_hand numeric(14, 4) not null default 0,
  delta_allocated numeric(14, 4) not null default 0,
  quantity numeric(14, 4) not null check (quantity > 0),
  correlation_id uuid,
  work_order_id uuid references public.work_orders (id) on delete set null,
  purchase_order_id uuid references public.org_purchase_orders (id) on delete set null,
  invoice_id uuid references public.org_invoices (id) on delete set null,
  counterparty_location_id uuid references public.inventory_locations (id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_transactions_org_created
  on public.inventory_transactions (organization_id, created_at desc);

create index if not exists idx_inventory_transactions_org_wo
  on public.inventory_transactions (organization_id, work_order_id)
  where work_order_id is not null;

create index if not exists idx_inventory_transactions_org_po
  on public.inventory_transactions (organization_id, purchase_order_id)
  where purchase_order_id is not null;

create index if not exists idx_inventory_transactions_correlation
  on public.inventory_transactions (organization_id, correlation_id)
  where correlation_id is not null;

comment on table public.inventory_transactions is
  'Ledger rows; paired transfers share correlation_id. Integrates with work orders, POs, invoices via FKs.';

-- -----------------------------------------------------------------------------
-- technician_vehicle_stock: assigns each technician a primary vehicle location (quantities in inventory_stock).
-- -----------------------------------------------------------------------------

create table if not exists public.technician_vehicle_stock (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  technician_id uuid not null references public.technicians (id) on delete cascade,
  inventory_location_id uuid not null references public.inventory_locations (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint technician_vehicle_stock_tech_unique unique (organization_id, technician_id),
  constraint technician_vehicle_stock_location_unique unique (organization_id, inventory_location_id)
);

create index if not exists idx_technician_vehicle_stock_org_tech
  on public.technician_vehicle_stock (organization_id, technician_id);

comment on table public.technician_vehicle_stock is
  'Maps a technician to the inventory_locations row used as their van stock bin; counts live in inventory_stock.';

-- -----------------------------------------------------------------------------
-- RLS (authenticated org members; writes restricted to manager roles — same as catalog_items pattern).
-- -----------------------------------------------------------------------------

alter table public.inventory_locations enable row level security;
alter table public.inventory_locations force row level security;
alter table public.inventory_stock enable row level security;
alter table public.inventory_stock force row level security;
alter table public.inventory_transactions enable row level security;
alter table public.inventory_transactions force row level security;
alter table public.technician_vehicle_stock enable row level security;
alter table public.technician_vehicle_stock force row level security;

revoke all on table public.inventory_locations from public, anon;
revoke all on table public.inventory_stock from public, anon;
revoke all on table public.inventory_transactions from public, anon;
revoke all on table public.technician_vehicle_stock from public, anon;

grant select, insert, update, delete on table public.inventory_locations to authenticated;
grant select, insert, update, delete on table public.inventory_stock to authenticated;
grant select, insert, update, delete on table public.inventory_transactions to authenticated;
grant select, insert, update, delete on table public.technician_vehicle_stock to authenticated;

drop policy if exists "inventory_locations_select_member" on public.inventory_locations;
create policy "inventory_locations_select_member"
on public.inventory_locations for select to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "inventory_locations_write_roles" on public.inventory_locations;
create policy "inventory_locations_write_roles"
on public.inventory_locations for all to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "inventory_stock_select_member" on public.inventory_stock;
create policy "inventory_stock_select_member"
on public.inventory_stock for select to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "inventory_stock_write_roles" on public.inventory_stock;
create policy "inventory_stock_write_roles"
on public.inventory_stock for all to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "inventory_transactions_select_member" on public.inventory_transactions;
create policy "inventory_transactions_select_member"
on public.inventory_transactions for select to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "inventory_transactions_insert_roles" on public.inventory_transactions;
create policy "inventory_transactions_insert_roles"
on public.inventory_transactions for insert to authenticated
with check (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "inventory_transactions_update_roles" on public.inventory_transactions;
create policy "inventory_transactions_update_roles"
on public.inventory_transactions for update to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

-- Ledger rows should be immutable; allow delete only for admin tooling (same role gate).
drop policy if exists "inventory_transactions_delete_roles" on public.inventory_transactions;
create policy "inventory_transactions_delete_roles"
on public.inventory_transactions for delete to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "technician_vehicle_stock_select_member" on public.technician_vehicle_stock;
create policy "technician_vehicle_stock_select_member"
on public.technician_vehicle_stock for select to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "technician_vehicle_stock_write_roles" on public.technician_vehicle_stock;
create policy "technician_vehicle_stock_write_roles"
on public.technician_vehicle_stock for all to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));
