-- Organization purchase orders with customer-friendly PO numbers.
-- Idempotent and safe across drifted environments.

create table if not exists public.org_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  purchase_order_number text,
  vendor text not null,
  vendor_email text,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'approved', 'ordered', 'partially_received', 'received', 'closed')),
  order_date date,
  expected_date date,
  total_cents bigint not null default 0 check (total_cents >= 0),
  line_items jsonb not null default '[]'::jsonb,
  notes text,
  customer_id uuid references public.customers (id) on delete set null,
  equipment_id uuid references public.equipment (id) on delete set null,
  work_order_id uuid references public.work_orders (id) on delete set null,
  ship_to text,
  bill_to text,
  is_archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint org_purchase_orders_archive_consistency check (
    (is_archived = true and archived_at is not null) or
    (is_archived = false and archived_at is null)
  )
);

create index if not exists idx_org_purchase_orders_org_created
  on public.org_purchase_orders (organization_id, created_at desc);

create index if not exists idx_org_purchase_orders_org_archived
  on public.org_purchase_orders (organization_id, is_archived);

create index if not exists idx_org_purchase_orders_org_status
  on public.org_purchase_orders (organization_id, status);

create sequence if not exists public.org_purchase_order_number_seq;

create or replace function public.format_purchase_order_number(next_number bigint)
returns text
language sql
immutable
as $$
  select 'PO-' || lpad(next_number::text, 6, '0');
$$;

do $$
declare
  max_po_number bigint;
begin
  select max((regexp_match(purchase_order_number, '^PO-([0-9]+)$'))[1]::bigint)
    into max_po_number
  from public.org_purchase_orders
  where purchase_order_number is not null and btrim(purchase_order_number) <> '';

  perform setval(
    'public.org_purchase_order_number_seq',
    greatest(coalesce(max_po_number, 0), 1),
    coalesce(max_po_number, 0) > 0
  );
end
$$;

update public.org_purchase_orders
set purchase_order_number = public.format_purchase_order_number(nextval('public.org_purchase_order_number_seq'))
where purchase_order_number is null or btrim(purchase_order_number) = '';

alter table public.org_purchase_orders
  alter column purchase_order_number set default public.format_purchase_order_number(nextval('public.org_purchase_order_number_seq'));

create or replace function public.assign_purchase_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.purchase_order_number is null or btrim(new.purchase_order_number) = '' then
    new.purchase_order_number := public.format_purchase_order_number(nextval('public.org_purchase_order_number_seq'));
  end if;
  return new;
end
$$;

drop trigger if exists trg_assign_purchase_order_number on public.org_purchase_orders;
create trigger trg_assign_purchase_order_number
before insert on public.org_purchase_orders
for each row
execute function public.assign_purchase_order_number();

do $$
begin
  alter table public.org_purchase_orders
    add constraint org_purchase_orders_org_po_number_unique unique (organization_id, purchase_order_number);
exception
  when duplicate_object then null;
end
$$;

alter table public.org_purchase_orders
  alter column purchase_order_number set not null;

do $$
begin
  if to_regprocedure('public.set_updated_at()') is null then
    create function public.set_updated_at()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $fn$
    begin
      new.updated_at := now();
      return new;
    end
    $fn$;
  end if;
end
$$;

drop trigger if exists trg_org_purchase_orders_set_updated_at on public.org_purchase_orders;
create trigger trg_org_purchase_orders_set_updated_at
before update on public.org_purchase_orders
for each row execute function public.set_updated_at();

revoke all on table public.org_purchase_orders from public, anon;
grant select, insert, update, delete on table public.org_purchase_orders to authenticated;

alter table public.org_purchase_orders enable row level security;

drop policy if exists "org_purchase_orders_select_member" on public.org_purchase_orders;
create policy "org_purchase_orders_select_member"
on public.org_purchase_orders
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "org_purchase_orders_write_roles" on public.org_purchase_orders;
create policy "org_purchase_orders_write_roles"
on public.org_purchase_orders
for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));
