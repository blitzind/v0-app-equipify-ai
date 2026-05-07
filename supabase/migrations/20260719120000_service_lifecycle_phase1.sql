-- Phase 1: Service lifecycle — WO↔invoice links, billing_state, invoice terms, org/customer defaults.
-- Non-destructive: additive columns/tables, backfill, RLS aligned with org_invoices.

-- ─── 1) Junction: one invoice → many work orders (canonical links; org_invoices.work_order_id retained for QB/UI compat)
create table if not exists public.invoice_work_order_links (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  invoice_id uuid not null references public.org_invoices (id) on delete cascade,
  work_order_id uuid not null,
  created_at timestamptz not null default now(),
  sort_order integer not null default 0,
  primary key (organization_id, invoice_id, work_order_id),
  constraint invoice_work_order_links_wo_fkey
    foreign key (organization_id, work_order_id)
    references public.work_orders (organization_id, id)
    on delete cascade
);

create index if not exists idx_invoice_wo_links_org_wo
  on public.invoice_work_order_links (organization_id, work_order_id);

create index if not exists idx_invoice_wo_links_org_inv
  on public.invoice_work_order_links (organization_id, invoice_id);

comment on table public.invoice_work_order_links is
  'Many-to-many links between org_invoices and work_orders. org_invoices.work_order_id remains the primary/legacy single link for sync.';

-- Backfill from legacy column
insert into public.invoice_work_order_links (organization_id, invoice_id, work_order_id, sort_order)
select i.organization_id, i.id, i.work_order_id, 0
from public.org_invoices i
where i.work_order_id is not null
on conflict (organization_id, invoice_id, work_order_id) do nothing;

alter table public.invoice_work_order_links enable row level security;
alter table public.invoice_work_order_links force row level security;

revoke all on table public.invoice_work_order_links from public, anon;
grant select, insert, update, delete on table public.invoice_work_order_links to authenticated;

drop policy if exists "invoice_wo_links_select_member" on public.invoice_work_order_links;
create policy "invoice_wo_links_select_member"
on public.invoice_work_order_links
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "invoice_wo_links_write_roles" on public.invoice_work_order_links;
create policy "invoice_wo_links_write_roles"
on public.invoice_work_order_links
for all
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

-- ─── 2) Work order billing_state (operational; nullable = legacy / unset)
alter table public.work_orders
  add column if not exists billing_state text;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'work_orders' and c.conname = 'work_orders_billing_state_check'
  ) then
    alter table public.work_orders
      add constraint work_orders_billing_state_check
      check (
        billing_state is null or billing_state in (
          'not_billable',
          'ready_for_billing',
          'invoiced',
          'paid'
        )
      );
  end if;
end $$;

comment on column public.work_orders.billing_state is
  'Operational billing position: not_billable | ready_for_billing | invoiced | paid. Nullable for legacy rows.';

create index if not exists idx_work_orders_org_billing_state
  on public.work_orders (organization_id, billing_state)
  where billing_state is not null;

-- ─── 3) Invoice terms (due date engine inputs)
alter table public.org_invoices
  add column if not exists terms_code text,
  add column if not exists terms_custom_days integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'org_invoices' and c.conname = 'org_invoices_terms_code_check'
  ) then
    alter table public.org_invoices
      add constraint org_invoices_terms_code_check
      check (
        terms_code is null or terms_code in (
          'due_on_receipt',
          'net_7',
          'net_14',
          'net_15',
          'net_30',
          'net_45',
          'net_60',
          'custom'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'org_invoices' and c.conname = 'org_invoices_terms_custom_days_check'
  ) then
    alter table public.org_invoices
      add constraint org_invoices_terms_custom_days_check
      check (terms_custom_days is null or (terms_custom_days >= 1 and terms_custom_days <= 365));
  end if;
end $$;

comment on column public.org_invoices.terms_code is
  'Invoice payment terms preset for due-date calculation: due_on_receipt | net_* | custom.';
comment on column public.org_invoices.terms_custom_days is
  'When terms_code = custom, days after issue date for due_date.';

-- ─── 4) Defaults on organization + customer
alter table public.organizations
  add column if not exists default_invoice_terms_code text;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'organizations' and c.conname = 'organizations_default_invoice_terms_code_check'
  ) then
    alter table public.organizations
      add constraint organizations_default_invoice_terms_code_check
      check (
        default_invoice_terms_code is null or default_invoice_terms_code in (
          'due_on_receipt',
          'net_7',
          'net_14',
          'net_15',
          'net_30',
          'net_45',
          'net_60',
          'custom'
        )
      );
  end if;
end $$;

alter table public.customers
  add column if not exists default_invoice_terms_code text;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'customers' and c.conname = 'customers_default_invoice_terms_code_check'
  ) then
    alter table public.customers
      add constraint customers_default_invoice_terms_code_check
      check (
        default_invoice_terms_code is null or default_invoice_terms_code in (
          'due_on_receipt',
          'net_7',
          'net_14',
          'net_15',
          'net_30',
          'net_45',
          'net_60',
          'custom'
        )
      );
  end if;
end $$;

comment on column public.organizations.default_invoice_terms_code is
  'Workspace default for new invoices when customer has no override.';
comment on column public.customers.default_invoice_terms_code is
  'Optional per-customer terms override; falls back to organization default.';
