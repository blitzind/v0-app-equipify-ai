-- Phase 38: Manual payment records for invoices (partial pay, allocation summary).
-- No payment processor; staff-entered payments only. Portal reads aggregates via existing service-role APIs.

create table if not exists public.org_invoice_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  invoice_id uuid not null references public.org_invoices (id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  paid_on date not null,
  payment_method text not null
    check (payment_method in ('cash', 'check', 'ach', 'wire', 'card', 'other')),
  reference text,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_org_invoice_payments_org_invoice
  on public.org_invoice_payments (organization_id, invoice_id);

create index if not exists idx_org_invoice_payments_org_paid_on
  on public.org_invoice_payments (organization_id, paid_on desc);

comment on table public.org_invoice_payments is
  'Staff-recorded payments against org_invoices; used for balance and partial-pay UI.';

revoke all on table public.org_invoice_payments from public, anon;
grant select, insert, update, delete on table public.org_invoice_payments to authenticated;

alter table public.org_invoice_payments enable row level security;

drop policy if exists "org_invoice_payments_select_member" on public.org_invoice_payments;
create policy "org_invoice_payments_select_member"
on public.org_invoice_payments
for select
to authenticated
using (
  public.is_org_member(organization_id)
  and not public.has_org_role(organization_id, array['tech'])
);

drop policy if exists "org_invoice_payments_write_roles" on public.org_invoice_payments;
create policy "org_invoice_payments_write_roles"
on public.org_invoice_payments
for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));
