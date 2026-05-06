-- Flags for demo/sample rows — delete/reseed tooling only touches is_sample = true.

alter table public.organizations
  add column if not exists demo_seed_industry text;

comment on column public.organizations.demo_seed_industry is
  'Last industry key used by in-app sample import (lib/demo-seeding/profiles).';

alter table public.customers
  add column if not exists is_sample boolean not null default false;

alter table public.equipment
  add column if not exists is_sample boolean not null default false;

alter table public.work_orders
  add column if not exists is_sample boolean not null default false;

alter table public.maintenance_plans
  add column if not exists is_sample boolean not null default false;

alter table public.org_quotes
  add column if not exists is_sample boolean not null default false;

alter table public.org_invoices
  add column if not exists is_sample boolean not null default false;

alter table public.organization_members
  add column if not exists is_sample boolean not null default false;

create index if not exists idx_customers_org_sample
  on public.customers (organization_id, is_sample)
  where is_sample = true;

create index if not exists idx_equipment_org_sample
  on public.equipment (organization_id, is_sample)
  where is_sample = true;

create index if not exists idx_work_orders_org_sample
  on public.work_orders (organization_id, is_sample)
  where is_sample = true;

create index if not exists idx_maintenance_plans_org_sample
  on public.maintenance_plans (organization_id, is_sample)
  where is_sample = true;

create index if not exists idx_org_quotes_org_sample
  on public.org_quotes (organization_id, is_sample)
  where is_sample = true;

create index if not exists idx_org_invoices_org_sample
  on public.org_invoices (organization_id, is_sample)
  where is_sample = true;

create index if not exists idx_org_members_org_sample
  on public.organization_members (organization_id, is_sample)
  where is_sample = true;

-- -----------------------------------------------------------------------------
-- Trigger repair (must run before UPDATE backfills):
-- `equipment_foundation` replaces public.prevent_organization_id_change() with a version
-- that references NEW.customer_id for immutability. The same function name is reused by
-- triggers on customers, customer_contacts, customer_locations, and organization_job_types —
-- those row types have no customer_id (customers uses id; job types have no customer).
-- Updates below fail with: record "new" has no field "customer_id".
--
-- Restore org-only immutability on the shared name; split equipment onto its own function.
-- -----------------------------------------------------------------------------
create or replace function public.prevent_organization_id_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id is immutable once created';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_organization_id_change() from public, anon, authenticated;
alter function public.prevent_organization_id_change() owner to postgres;

create or replace function public.prevent_equipment_identity_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id is immutable once created';
  end if;
  if new.customer_id is distinct from old.customer_id then
    raise exception 'customer_id is immutable once created';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_equipment_identity_change() from public, anon, authenticated;
alter function public.prevent_equipment_identity_change() owner to postgres;

drop trigger if exists trg_equipment_immutable_org on public.equipment;
create trigger trg_equipment_immutable_org
before update on public.equipment
for each row execute function public.prevent_equipment_identity_change();

-- -----------------------------------------------------------------------------
-- Backfill: existing demo rows from known seed patterns (best-effort).
-- -----------------------------------------------------------------------------
update public.customers
set is_sample = true
where coalesce(external_code, '') ilike 'demo-%'
   or coalesce(external_code, '') like 'pbs-seed-cust-%';

update public.equipment e
set is_sample = true
from public.customers c
where e.organization_id = c.organization_id
  and e.customer_id = c.id
  and c.is_sample = true;

update public.work_orders w
set is_sample = true
from public.customers c
where w.organization_id = c.organization_id
  and w.customer_id = c.id
  and c.is_sample = true;

update public.maintenance_plans m
set is_sample = true
from public.customers c
where m.organization_id = c.organization_id
  and m.customer_id = c.id
  and c.is_sample = true;

update public.org_quotes
set is_sample = true
where seed_key like 'pbs-seed-qt-%';

update public.org_invoices
set is_sample = true
where seed_key like 'pbs-seed-inv-%';

update public.organization_members om
set is_sample = true
from public.profiles p
where p.id = om.user_id
  and coalesce(p.email::text, '') ilike '%@equipify.demo';
