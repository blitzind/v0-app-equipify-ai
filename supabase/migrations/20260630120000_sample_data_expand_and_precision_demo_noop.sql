-- Expand sample-data tooling + disable legacy SQL mini-seed that blocked full demo imports.

-- -----------------------------------------------------------------------------
-- is_sample on additional tenant tables (reset deletes these before core FK rows)
-- -----------------------------------------------------------------------------
alter table public.calibration_templates
  add column if not exists is_sample boolean not null default false;

alter table public.calibration_records
  add column if not exists is_sample boolean not null default false;

alter table public.org_vendors
  add column if not exists is_sample boolean not null default false;

alter table public.catalog_items
  add column if not exists is_sample boolean not null default false;

alter table public.org_purchase_orders
  add column if not exists is_sample boolean not null default false;

alter table public.technicians
  add column if not exists is_sample boolean not null default false;

create index if not exists idx_calibration_templates_org_sample
  on public.calibration_templates (organization_id, is_sample)
  where is_sample = true;

create index if not exists idx_calibration_records_org_sample
  on public.calibration_records (organization_id, is_sample)
  where is_sample = true;

create index if not exists idx_org_vendors_org_sample
  on public.org_vendors (organization_id, is_sample)
  where is_sample = true;

create index if not exists idx_catalog_items_org_sample
  on public.catalog_items (organization_id, is_sample)
  where is_sample = true;

create index if not exists idx_org_purchase_orders_org_sample
  on public.org_purchase_orders (organization_id, is_sample)
  where is_sample = true;

create index if not exists idx_technicians_org_sample
  on public.technicians (organization_id, is_sample)
  where is_sample = true;

-- -----------------------------------------------------------------------------
-- Precision demo RPC: no-op (rich seed is lib/demo-seeding/seed-engine.ts)
-- -----------------------------------------------------------------------------
create or replace function public.seed_precision_biomedical_demo_if_empty()
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- Previously inserted a minimal customer/equipment/work-order set on login.
  -- That prevented Settings → Import sample data from loading the full relational demo.
  return;
end;
$$;

revoke all on function public.seed_precision_biomedical_demo_if_empty() from public;
grant execute on function public.seed_precision_biomedical_demo_if_empty() to authenticated;
alter function public.seed_precision_biomedical_demo_if_empty() owner to postgres;
