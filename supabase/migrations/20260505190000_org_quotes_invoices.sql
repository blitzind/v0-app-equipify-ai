-- Tenant-scoped quotes and invoices for marketing / demo seeds (optional UI wiring later).
-- Cleared and re-seeded only by scripts/seed-precision-biomedical-demo.cjs for the Precision org.

create table if not exists public.org_quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null,
  seed_key text not null,
  quote_number text not null,
  title text not null,
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  status text not null default 'sent'
    check (status in ('draft', 'sent', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint org_quotes_customer_org_fkey
    foreign key (organization_id, customer_id)
    references public.customers (organization_id, id)
    on delete cascade,
  constraint org_quotes_org_seed_key unique (organization_id, seed_key),
  constraint org_quotes_org_quote_number unique (organization_id, quote_number)
);

create index if not exists idx_org_quotes_org_created
  on public.org_quotes (organization_id, created_at desc);

create table if not exists public.org_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null,
  equipment_id uuid,
  seed_key text not null,
  invoice_number text not null,
  title text not null,
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  status text not null default 'paid'
    check (status in ('draft', 'sent', 'paid', 'overdue')),
  issued_at date not null,
  paid_at date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint org_invoices_customer_org_fkey
    foreign key (organization_id, customer_id)
    references public.customers (organization_id, id)
    on delete cascade,
  constraint org_invoices_equipment_org_fkey
    foreign key (organization_id, equipment_id)
    references public.equipment (organization_id, id)
    on delete set null,
  constraint org_invoices_org_seed_key unique (organization_id, seed_key),
  constraint org_invoices_org_invoice_number unique (organization_id, invoice_number)
);

create index if not exists idx_org_invoices_org_issued
  on public.org_invoices (organization_id, issued_at desc);

revoke all on table public.org_quotes from public, anon;
revoke all on table public.org_invoices from public, anon;

grant select, insert, update, delete on table public.org_quotes to authenticated;
grant select, insert, update, delete on table public.org_invoices to authenticated;

alter table public.org_quotes enable row level security;
alter table public.org_invoices enable row level security;

drop policy if exists "org_quotes_select_member" on public.org_quotes;
create policy "org_quotes_select_member"
on public.org_quotes
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "org_quotes_write_roles" on public.org_quotes;
create policy "org_quotes_write_roles"
on public.org_quotes
for all
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "org_invoices_select_member" on public.org_invoices;
create policy "org_invoices_select_member"
on public.org_invoices
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "org_invoices_write_roles" on public.org_invoices;
create policy "org_invoices_write_roles"
on public.org_invoices
for all
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

comment on table public.org_quotes is
  'Demo/marketing quotes per organization; seed_key pbs-seed-qt-* for idempotent Precision seed.';

comment on table public.org_invoices is
  'Demo/marketing invoices per organization; seed_key pbs-seed-inv-* for idempotent Precision seed.';
