-- Vendors + purchase-order vendor linkage.
-- Idempotent and safe to re-run.

create table if not exists public.org_vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  contact_name text,
  billing_address text,
  shipping_address text,
  notes text,
  is_archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint org_vendors_archive_consistency check (
    (is_archived = true and archived_at is not null) or
    (is_archived = false and archived_at is null)
  )
);

create index if not exists idx_org_vendors_org_name
  on public.org_vendors (organization_id, name);

create index if not exists idx_org_vendors_org_archived
  on public.org_vendors (organization_id, is_archived);

do $$
begin
  alter table public.org_vendors
    add constraint org_vendors_org_name_email_unique
    unique (organization_id, name, email);
exception
  when duplicate_object then null;
end
$$;

alter table public.org_purchase_orders
  add column if not exists vendor_id uuid references public.org_vendors (id) on delete set null,
  add column if not exists vendor_phone text,
  add column if not exists vendor_contact_name text;

create index if not exists idx_org_purchase_orders_vendor
  on public.org_purchase_orders (organization_id, vendor_id);

-- Backfill vendors from PO snapshots where absent.
insert into public.org_vendors (
  organization_id,
  name,
  email,
  phone,
  contact_name,
  billing_address,
  shipping_address
)
select distinct
  po.organization_id,
  po.vendor,
  po.vendor_email,
  po.vendor_phone,
  po.vendor_contact_name,
  po.bill_to,
  po.ship_to
from public.org_purchase_orders po
where po.vendor is not null
  and btrim(po.vendor) <> ''
  and not exists (
    select 1
    from public.org_vendors v
    where v.organization_id = po.organization_id
      and v.name = po.vendor
      and coalesce(v.email, '') = coalesce(po.vendor_email, '')
  );

-- Link PO rows to matching vendors.
update public.org_purchase_orders po
set vendor_id = v.id
from public.org_vendors v
where po.vendor_id is null
  and v.organization_id = po.organization_id
  and v.name = po.vendor
  and coalesce(v.email, '') = coalesce(po.vendor_email, '');

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_org_vendors_set_updated_at on public.org_vendors;
    create trigger trg_org_vendors_set_updated_at
    before update on public.org_vendors
    for each row execute function public.set_updated_at();
  end if;
end
$$;

revoke all on table public.org_vendors from public, anon;
grant select, insert, update, delete on table public.org_vendors to authenticated;

alter table public.org_vendors enable row level security;

drop policy if exists "org_vendors_select_member" on public.org_vendors;
create policy "org_vendors_select_member"
on public.org_vendors
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "org_vendors_write_roles" on public.org_vendors;
create policy "org_vendors_write_roles"
on public.org_vendors
for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));
