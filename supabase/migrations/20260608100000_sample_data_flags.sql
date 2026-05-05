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
