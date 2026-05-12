-- BlitzPay Phase 3A — General Ledger & Accounting Engine (double-entry, org-scoped).
-- Internal accounting source of truth; Stripe remains settlement authority for card/ACH movement.
-- RLS: owner/admin/manager read; writes via service-role Route Handlers only.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regprocedure('public.is_org_member(uuid)') is null then
    raise exception 'Missing dependency: public.is_org_member(uuid)';
  end if;
  if to_regprocedure('public.has_org_role(uuid, text[])') is null then
    raise exception 'Missing dependency: public.has_org_role(uuid, text[])';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'Missing dependency: public.set_updated_at()';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Chart of accounts
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_code text not null,
  account_name text not null,
  account_type text not null
    check (account_type in (
      'asset', 'liability', 'equity', 'revenue', 'expense',
      'contra_asset', 'contra_liability'
    )),
  parent_account_id uuid references public.blitzpay_chart_of_accounts (id) on delete set null,
  is_system_account boolean not null default false,
  is_active boolean not null default true,
  normal_balance text not null check (normal_balance in ('debit', 'credit')),
  reporting_category text,
  currency text not null default 'usd',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blitzpay_coa_org_code unique (organization_id, account_code)
);

comment on table public.blitzpay_chart_of_accounts is
  'Org chart of accounts; system rows seeded by app (ensureBlitzpayDefaultChartOfAccounts).';

create index if not exists idx_blitzpay_coa_org_active
  on public.blitzpay_chart_of_accounts (organization_id, is_active, account_type);

create index if not exists idx_blitzpay_coa_parent
  on public.blitzpay_chart_of_accounts (organization_id, parent_account_id);

-- ---------------------------------------------------------------------------
-- Journal batches
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_journal_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  batch_reference text not null,
  batch_type text not null
    check (batch_type in (
      'invoice', 'payment', 'payout', 'payroll', 'adjustment', 'accrual',
      'deferred_revenue', 'treasury_reconciliation', 'ap', 'ar', 'manual'
    )),
  status text not null default 'draft'
    check (status in ('draft', 'posted', 'reversed', 'archived')),
  source_type text,
  source_id uuid,
  posted_at timestamptz,
  created_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blitzpay_journal_batches_org_ref unique (organization_id, batch_reference)
);

comment on table public.blitzpay_journal_batches is
  'Logical posting batch; status posted locks underlying journal entries and lines.';

create index if not exists idx_blitzpay_journal_batches_org_status
  on public.blitzpay_journal_batches (organization_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- Journal entries (balanced double-entry groups)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_journal_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  batch_id uuid not null references public.blitzpay_journal_batches (id) on delete cascade,
  entry_reference text not null,
  entry_date date not null,
  memo text,
  source_type text,
  source_id uuid,
  total_debits_cents bigint not null default 0 check (total_debits_cents >= 0),
  total_credits_cents bigint not null default 0 check (total_credits_cents >= 0),
  is_balanced boolean not null default false,
  is_reversing_entry boolean not null default false,
  reversal_entry_id uuid references public.blitzpay_journal_entries (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint blitzpay_journal_entries_org_entry_ref unique (organization_id, entry_reference),
  constraint blitzpay_journal_entries_totals_balanced check (
    (is_balanced = false) or (total_debits_cents = total_credits_cents and total_debits_cents > 0)
  )
);

comment on table public.blitzpay_journal_entries is
  'Balanced journal entry; immutable once parent batch is posted (enforced by trigger).';

create index if not exists idx_blitzpay_journal_entries_org_batch
  on public.blitzpay_journal_entries (organization_id, batch_id, entry_date desc);

-- ---------------------------------------------------------------------------
-- Journal lines
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_journal_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  journal_entry_id uuid not null references public.blitzpay_journal_entries (id) on delete cascade,
  account_id uuid not null references public.blitzpay_chart_of_accounts (id) on delete restrict,
  line_type text not null check (line_type in ('debit', 'credit')),
  amount_cents bigint not null check (amount_cents > 0),
  description text,
  customer_id uuid references public.customers (id) on delete set null,
  vendor_id uuid,
  work_order_id uuid references public.work_orders (id) on delete set null,
  invoice_id uuid references public.org_invoices (id) on delete set null,
  equipment_id uuid references public.equipment (id) on delete set null,
  technician_id uuid,
  department text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.blitzpay_journal_lines is
  'Posted journal lines; no updates/deletes when batch is posted.';

create index if not exists idx_blitzpay_journal_lines_entry
  on public.blitzpay_journal_lines (journal_entry_id, line_type);

create index if not exists idx_blitzpay_journal_lines_org_account
  on public.blitzpay_journal_lines (organization_id, account_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Financial periods
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_financial_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  period_name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'open' check (status in ('open', 'soft_closed', 'closed')),
  closed_at timestamptz,
  closed_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blitzpay_financial_periods_org_name unique (organization_id, period_name),
  constraint blitzpay_financial_periods_dates check (end_date >= start_date)
);

create index if not exists idx_blitzpay_financial_periods_org_dates
  on public.blitzpay_financial_periods (organization_id, start_date, end_date);

-- ---------------------------------------------------------------------------
-- Deferred revenue schedules
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_deferred_revenue_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  customer_id uuid references public.customers (id) on delete set null,
  original_amount_cents bigint not null check (original_amount_cents >= 0),
  recognized_amount_cents bigint not null default 0 check (recognized_amount_cents >= 0),
  remaining_amount_cents bigint not null default 0 check (remaining_amount_cents >= 0),
  recognition_frequency text not null
    check (recognition_frequency in ('daily', 'weekly', 'monthly', 'milestone')),
  next_recognition_date date,
  start_date date not null,
  end_date date,
  status text not null default 'active' check (status in ('active', 'completed', 'canceled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blitzpay_deferred_rev_remaining check (remaining_amount_cents <= original_amount_cents)
);

create index if not exists idx_blitzpay_deferred_rev_org_status_next
  on public.blitzpay_deferred_revenue_schedules (organization_id, status, next_recognition_date);

-- ---------------------------------------------------------------------------
-- Account balances (posting snapshots)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_account_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_id uuid not null references public.blitzpay_chart_of_accounts (id) on delete cascade,
  balance_date date not null,
  debit_balance_cents bigint not null default 0 check (debit_balance_cents >= 0),
  credit_balance_cents bigint not null default 0 check (credit_balance_cents >= 0),
  net_balance_cents bigint not null default 0,
  source text not null default 'system' check (source in ('system', 'reconciliation', 'adjustment')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint blitzpay_account_balances_org_acct_day unique (organization_id, account_id, balance_date, source)
);

create index if not exists idx_blitzpay_account_balances_org_date
  on public.blitzpay_account_balances (organization_id, balance_date desc);

-- ---------------------------------------------------------------------------
-- Triggers: COA parent cycle guard
-- ---------------------------------------------------------------------------
create or replace function public.blitzpay_coa_prevent_parent_cycle()
returns trigger
language plpgsql
as $$
declare
  cur uuid;
  steps integer := 0;
begin
  if new.parent_account_id is null then
    return new;
  end if;
  if new.parent_account_id = new.id then
    raise exception 'Chart account cannot be its own parent';
  end if;
  cur := new.parent_account_id;
  while cur is not null and steps < 64 loop
    if cur = new.id then
      raise exception 'Chart of accounts parent chain would cycle';
    end if;
    select parent_account_id into cur
    from public.blitzpay_chart_of_accounts
    where id = cur and organization_id = new.organization_id;
    steps := steps + 1;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_blitzpay_coa_parent_cycle on public.blitzpay_chart_of_accounts;
create trigger trg_blitzpay_coa_parent_cycle
before insert or update of parent_account_id on public.blitzpay_chart_of_accounts
for each row execute function public.blitzpay_coa_prevent_parent_cycle();

-- ---------------------------------------------------------------------------
-- Triggers: immutable posted journals
-- ---------------------------------------------------------------------------
create or replace function public.blitzpay_journal_batch_is_posted(p_batch_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.blitzpay_journal_batches b
    where b.id = p_batch_id and b.status = 'posted'
  );
$$;

create or replace function public.blitzpay_journal_lines_block_mutation_if_posted()
returns trigger
language plpgsql
as $$
declare
  bid uuid;
begin
  if tg_op = 'DELETE' then
    select batch_id into bid
    from public.blitzpay_journal_entries e
    where e.id = old.journal_entry_id;
    if public.blitzpay_journal_batch_is_posted(bid) then
      raise exception 'Cannot delete journal lines from a posted batch';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    select batch_id into bid
    from public.blitzpay_journal_entries e
    where e.id = old.journal_entry_id;
    if public.blitzpay_journal_batch_is_posted(bid) then
      raise exception 'Cannot update journal lines from a posted batch';
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    select batch_id into bid
    from public.blitzpay_journal_entries e
    where e.id = new.journal_entry_id;
    if public.blitzpay_journal_batch_is_posted(bid) then
      raise exception 'Cannot insert journal lines into a posted batch';
    end if;
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_blitzpay_journal_lines_immutable on public.blitzpay_journal_lines;
create trigger trg_blitzpay_journal_lines_immutable
before insert or update or delete on public.blitzpay_journal_lines
for each row execute function public.blitzpay_journal_lines_block_mutation_if_posted();

create or replace function public.blitzpay_journal_entries_block_mutation_if_posted()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if public.blitzpay_journal_batch_is_posted(new.batch_id) then
      raise exception 'Cannot add journal entries to a posted batch';
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if public.blitzpay_journal_batch_is_posted(old.batch_id) then
      raise exception 'Cannot update journal entries from a posted batch';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if public.blitzpay_journal_batch_is_posted(old.batch_id) then
      raise exception 'Cannot delete journal entries from a posted batch';
    end if;
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_blitzpay_journal_entries_immutable on public.blitzpay_journal_entries;
create trigger trg_blitzpay_journal_entries_immutable
before insert or update or delete on public.blitzpay_journal_entries
for each row execute function public.blitzpay_journal_entries_block_mutation_if_posted();

create or replace function public.blitzpay_journal_batches_block_status_downgrade()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'posted' and new.status is distinct from old.status then
    if new.status not in ('posted', 'reversed', 'archived') then
      raise exception 'Posted journal batch cannot revert to draft';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_blitzpay_journal_batches_status on public.blitzpay_journal_batches;
create trigger trg_blitzpay_journal_batches_status
before update of status on public.blitzpay_journal_batches
for each row execute function public.blitzpay_journal_batches_block_status_downgrade();

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists trg_blitzpay_coa_updated on public.blitzpay_chart_of_accounts;
create trigger trg_blitzpay_coa_updated
before update on public.blitzpay_chart_of_accounts
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_journal_batches_updated on public.blitzpay_journal_batches;
create trigger trg_blitzpay_journal_batches_updated
before update on public.blitzpay_journal_batches
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_financial_periods_updated on public.blitzpay_financial_periods;
create trigger trg_blitzpay_financial_periods_updated
before update on public.blitzpay_financial_periods
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_deferred_rev_updated on public.blitzpay_deferred_revenue_schedules;
create trigger trg_blitzpay_deferred_rev_updated
before update on public.blitzpay_deferred_revenue_schedules
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
revoke all on table public.blitzpay_chart_of_accounts from public, anon;
revoke all on table public.blitzpay_journal_batches from public, anon;
revoke all on table public.blitzpay_journal_entries from public, anon;
revoke all on table public.blitzpay_journal_lines from public, anon;
revoke all on table public.blitzpay_financial_periods from public, anon;
revoke all on table public.blitzpay_deferred_revenue_schedules from public, anon;
revoke all on table public.blitzpay_account_balances from public, anon;

grant select on table public.blitzpay_chart_of_accounts to authenticated;
grant select on table public.blitzpay_journal_batches to authenticated;
grant select on table public.blitzpay_journal_entries to authenticated;
grant select on table public.blitzpay_journal_lines to authenticated;
grant select on table public.blitzpay_financial_periods to authenticated;
grant select on table public.blitzpay_deferred_revenue_schedules to authenticated;
grant select on table public.blitzpay_account_balances to authenticated;

alter table public.blitzpay_chart_of_accounts enable row level security;
alter table public.blitzpay_chart_of_accounts force row level security;
alter table public.blitzpay_journal_batches enable row level security;
alter table public.blitzpay_journal_batches force row level security;
alter table public.blitzpay_journal_entries enable row level security;
alter table public.blitzpay_journal_entries force row level security;
alter table public.blitzpay_journal_lines enable row level security;
alter table public.blitzpay_journal_lines force row level security;
alter table public.blitzpay_financial_periods enable row level security;
alter table public.blitzpay_financial_periods force row level security;
alter table public.blitzpay_deferred_revenue_schedules enable row level security;
alter table public.blitzpay_deferred_revenue_schedules force row level security;
alter table public.blitzpay_account_balances enable row level security;
alter table public.blitzpay_account_balances force row level security;

drop policy if exists "blitzpay_coa_select_finance_roles" on public.blitzpay_chart_of_accounts;
create policy "blitzpay_coa_select_finance_roles"
on public.blitzpay_chart_of_accounts
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_journal_batches_select_finance_roles" on public.blitzpay_journal_batches;
create policy "blitzpay_journal_batches_select_finance_roles"
on public.blitzpay_journal_batches
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_journal_entries_select_finance_roles" on public.blitzpay_journal_entries;
create policy "blitzpay_journal_entries_select_finance_roles"
on public.blitzpay_journal_entries
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_journal_lines_select_finance_roles" on public.blitzpay_journal_lines;
create policy "blitzpay_journal_lines_select_finance_roles"
on public.blitzpay_journal_lines
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_financial_periods_select_finance_roles" on public.blitzpay_financial_periods;
create policy "blitzpay_financial_periods_select_finance_roles"
on public.blitzpay_financial_periods
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_deferred_rev_select_finance_roles" on public.blitzpay_deferred_revenue_schedules;
create policy "blitzpay_deferred_rev_select_finance_roles"
on public.blitzpay_deferred_revenue_schedules
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_account_balances_select_finance_roles" on public.blitzpay_account_balances;
create policy "blitzpay_account_balances_select_finance_roles"
on public.blitzpay_account_balances
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));
