-- Customer foundation (tenant-scoped)
-- Creates customers, customer_contacts, customer_locations with RLS.

create extension if not exists citext;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  external_code text,
  company_name text not null check (char_length(trim(company_name)) > 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  joined_at date not null default current_date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_archived boolean not null default false,
  archived_at timestamptz,
  constraint customers_org_id_unique unique (organization_id, id),
  unique (organization_id, external_code)
);

create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null,
  full_name text not null check (char_length(trim(full_name)) > 0),
  first_name text,
  last_name text,
  role text,
  email citext,
  phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_contacts_customer_org_fkey
    foreign key (organization_id, customer_id)
    references public.customers (organization_id, id)
    on delete cascade
);

create table if not exists public.customer_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null,
  name text not null check (char_length(trim(name)) > 0),
  address_line1 text not null check (char_length(trim(address_line1)) > 0),
  address_line2 text,
  city text not null check (char_length(trim(city)) > 0),
  state text not null check (char_length(trim(state)) > 0),
  postal_code text not null check (char_length(trim(postal_code)) > 0),
  phone text,
  contact_person text,
  notes text,
  is_default boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_locations_customer_org_fkey
    foreign key (organization_id, customer_id)
    references public.customers (organization_id, id)
    on delete cascade
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index if not exists idx_customers_org
  on public.customers (organization_id);

create index if not exists idx_customers_org_company
  on public.customers (organization_id, company_name);

create index if not exists idx_customers_org_status
  on public.customers (organization_id, status);

create index if not exists idx_customers_org_archived
  on public.customers (organization_id, is_archived);

create index if not exists idx_customer_contacts_org_customer
  on public.customer_contacts (organization_id, customer_id);

create index if not exists idx_customer_contacts_org_email
  on public.customer_contacts (organization_id, email);

create unique index if not exists idx_customer_contacts_primary_per_customer
  on public.customer_contacts (customer_id)
  where is_primary = true;

create index if not exists idx_customer_locations_org_customer
  on public.customer_locations (organization_id, customer_id);

create index if not exists idx_customer_locations_org_archived
  on public.customer_locations (organization_id, is_archived);

create unique index if not exists idx_customer_locations_default_per_customer
  on public.customer_locations (customer_id)
  where is_default = true and is_archived = false;

-- -----------------------------------------------------------------------------
-- updated_at trigger support
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;
revoke all on function public.set_updated_at() from anon, authenticated;
alter function public.set_updated_at() owner to postgres;

drop trigger if exists trg_customers_set_updated_at on public.customers;
create trigger trg_customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists trg_customer_contacts_set_updated_at on public.customer_contacts;
create trigger trg_customer_contacts_set_updated_at
before update on public.customer_contacts
for each row execute function public.set_updated_at();

drop trigger if exists trg_customer_locations_set_updated_at on public.customer_locations;
create trigger trg_customer_locations_set_updated_at
before update on public.customer_locations
for each row execute function public.set_updated_at();

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

drop trigger if exists trg_customers_immutable_org on public.customers;
create trigger trg_customers_immutable_org
before update on public.customers
for each row execute function public.prevent_organization_id_change();

drop trigger if exists trg_customer_contacts_immutable_org on public.customer_contacts;
create trigger trg_customer_contacts_immutable_org
before update on public.customer_contacts
for each row execute function public.prevent_organization_id_change();

drop trigger if exists trg_customer_locations_immutable_org on public.customer_locations;
create trigger trg_customer_locations_immutable_org
before update on public.customer_locations
for each row execute function public.prevent_organization_id_change();

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

revoke all on table public.customers from public, anon;
revoke all on table public.customer_contacts from public, anon;
revoke all on table public.customer_locations from public, anon;

grant select, insert, update on table public.customers to authenticated;
grant select, insert, update, delete on table public.customer_contacts to authenticated;
grant select, insert, update, delete on table public.customer_locations to authenticated;

do $$
begin
  if to_regprocedure('public.is_org_member(uuid)') is null then
    raise exception 'Missing dependency: function public.is_org_member(uuid) must exist before this migration.';
  end if;

  if to_regprocedure('public.has_org_role(uuid,text[])') is null then
    raise exception 'Missing dependency: function public.has_org_role(uuid,text[]) must exist before this migration.';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.customer_locations enable row level security;

-- customers policies
drop policy if exists "customers_select_member" on public.customers;
create policy "customers_select_member"
on public.customers
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "customers_insert_owner_admin_manager" on public.customers;
create policy "customers_insert_owner_admin_manager"
on public.customers
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);

drop policy if exists "customers_update_owner_admin_manager" on public.customers;
create policy "customers_update_owner_admin_manager"
on public.customers
for update
to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
)
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);

drop policy if exists "customers_delete_owner_admin_manager" on public.customers;

-- customer_contacts policies
drop policy if exists "customer_contacts_select_member" on public.customer_contacts;
create policy "customer_contacts_select_member"
on public.customer_contacts
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "customer_contacts_insert_owner_admin_manager" on public.customer_contacts;
create policy "customer_contacts_insert_owner_admin_manager"
on public.customer_contacts
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);

drop policy if exists "customer_contacts_update_owner_admin_manager" on public.customer_contacts;
create policy "customer_contacts_update_owner_admin_manager"
on public.customer_contacts
for update
to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
)
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);

drop policy if exists "customer_contacts_delete_owner_admin_manager" on public.customer_contacts;
create policy "customer_contacts_delete_owner_admin_manager"
on public.customer_contacts
for delete
to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);

-- customer_locations policies
drop policy if exists "customer_locations_select_member" on public.customer_locations;
create policy "customer_locations_select_member"
on public.customer_locations
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "customer_locations_insert_owner_admin_manager" on public.customer_locations;
create policy "customer_locations_insert_owner_admin_manager"
on public.customer_locations
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);

drop policy if exists "customer_locations_update_owner_admin_manager" on public.customer_locations;
create policy "customer_locations_update_owner_admin_manager"
on public.customer_locations
for update
to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
)
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);

drop policy if exists "customer_locations_delete_owner_admin_manager" on public.customer_locations;
create policy "customer_locations_delete_owner_admin_manager"
on public.customer_locations
for delete
to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);
