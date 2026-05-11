-- BlitzPay Phase 2S — contractor accounts payable (vendor payables + internal payout records).
-- No bank account storage; no outbound money movement — tracking + scheduling only.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regprocedure('public.is_org_member(uuid)') is null then
    raise exception 'Missing dependency: public.is_org_member(uuid)';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1) Vendor / subcontractor / supplier / reimbursement payables
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_vendor_payables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vendor_kind text not null
    check (
      vendor_kind in (
        'vendor',
        'subcontractor',
        'field_reimbursement',
        'equipment_supplier',
        'material_supplier'
      )
    ),
  counterparty_label text not null check (char_length(trim(counterparty_label)) > 0),
  org_vendor_id uuid references public.org_vendors (id) on delete set null,
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'usd' check (lower(currency) = currency),
  due_date date not null,
  scheduled_payout_date date,
  paid_at timestamptz,
  status text not null default 'draft'
    check (
      status in (
        'draft',
        'pending_approval',
        'approved',
        'scheduled',
        'paid',
        'failed'
      )
    ),
  approval_notes text,
  approved_by_user_id uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  requested_by_user_id uuid references auth.users (id) on delete set null,
  work_order_id uuid references public.work_orders (id) on delete set null,
  org_invoice_id uuid references public.org_invoices (id) on delete set null,
  org_purchase_order_id uuid references public.org_purchase_orders (id) on delete set null,
  reimbursement_flag boolean not null default false,
  material_cost_flag boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_vendor_payables is
  'Org-scoped vendor AP lines (scheduling/approvals). Not customer-visible; no bank rails.';

create index if not exists idx_blitzpay_vendor_payables_org_due
  on public.blitzpay_vendor_payables (organization_id, due_date);

create index if not exists idx_blitzpay_vendor_payables_org_status
  on public.blitzpay_vendor_payables (organization_id, status, due_date);

create index if not exists idx_blitzpay_vendor_payables_org_work_order
  on public.blitzpay_vendor_payables (organization_id, work_order_id)
  where work_order_id is not null;

-- ---------------------------------------------------------------------------
-- 2) Internal “payout recorded” rows when a payable is marked paid (velocity / analytics)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_vendor_payouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vendor_payable_id uuid not null references public.blitzpay_vendor_payables (id) on delete cascade,
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'usd' check (lower(currency) = currency),
  recorded_at timestamptz not null default now(),
  settlement_channel text not null default 'internal_record'
    check (settlement_channel in ('internal_record', 'scheduled_placeholder'))
);

comment on table public.blitzpay_vendor_payouts is
  'Append-only internal record when a vendor payable is marked paid (not Stripe po_ payouts).';

create index if not exists idx_blitzpay_vendor_payouts_org_recorded
  on public.blitzpay_vendor_payouts (organization_id, recorded_at desc);

create index if not exists idx_blitzpay_vendor_payouts_payable
  on public.blitzpay_vendor_payouts (vendor_payable_id);

drop trigger if exists trg_blitzpay_vendor_payables_set_updated_at on public.blitzpay_vendor_payables;
create trigger trg_blitzpay_vendor_payables_set_updated_at
before update on public.blitzpay_vendor_payables
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Grants + RLS (authenticated org members read-only; writes via service role APIs)
-- ---------------------------------------------------------------------------
revoke all on table public.blitzpay_vendor_payables from public, anon;
revoke all on table public.blitzpay_vendor_payouts from public, anon;

grant select on table public.blitzpay_vendor_payables to authenticated;
grant select on table public.blitzpay_vendor_payouts to authenticated;

alter table public.blitzpay_vendor_payables enable row level security;
alter table public.blitzpay_vendor_payables force row level security;

alter table public.blitzpay_vendor_payouts enable row level security;
alter table public.blitzpay_vendor_payouts force row level security;

drop policy if exists "blitzpay_vendor_payables_select_member" on public.blitzpay_vendor_payables;
create policy "blitzpay_vendor_payables_select_member"
on public.blitzpay_vendor_payables
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "blitzpay_vendor_payouts_select_member" on public.blitzpay_vendor_payouts;
create policy "blitzpay_vendor_payouts_select_member"
on public.blitzpay_vendor_payouts
for select
to authenticated
using (public.is_org_member (organization_id));
