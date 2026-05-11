-- BlitzPay Phase 2X — native memberships / service-agreement billing hooks (deterministic ops surface).
-- RLS: org members read; writes via service-role APIs (same pattern as other BlitzPay ledger tables).

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
end;
$$;

-- ---------------------------------------------------------------------------
-- 1) Membership / recurring agreement header
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  maintenance_plan_id uuid references public.maintenance_plans (id) on delete set null,
  work_order_template_id uuid,
  membership_number text not null,
  status text not null default 'active'
    check (status in ('active', 'paused', 'delinquent', 'canceled', 'expired')),
  billing_frequency text not null
    check (billing_frequency in ('weekly', 'monthly', 'quarterly', 'annual')),
  billing_anchor_date date not null,
  next_invoice_at timestamptz,
  next_work_order_at timestamptz,
  auto_renew boolean not null default true,
  auto_bill_enabled boolean not null default false,
  default_payment_method_profile_id uuid references public.blitzpay_customer_payment_profiles (id) on delete set null,
  recurring_amount_cents bigint not null check (recurring_amount_cents >= 0),
  renewal_notice_days integer not null default 14 check (renewal_notice_days >= 0 and renewal_notice_days <= 120),
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  canceled_at timestamptz,
  cancellation_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blitzpay_memberships_org_number unique (organization_id, membership_number)
);

comment on table public.blitzpay_memberships is
  'Org-scoped service membership / recurring agreement billing anchor (native; not Stripe Subscription ids).';

create index if not exists idx_blitzpay_memberships_org_status_next_inv
  on public.blitzpay_memberships (organization_id, status, next_invoice_at);

create index if not exists idx_blitzpay_memberships_org_customer
  on public.blitzpay_memberships (organization_id, customer_id, created_at desc);

create index if not exists idx_blitzpay_memberships_org_plan
  on public.blitzpay_memberships (organization_id, maintenance_plan_id)
  where maintenance_plan_id is not null;

-- ---------------------------------------------------------------------------
-- 2) Link generated org invoices back to membership + billing period
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_membership_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  membership_id uuid not null references public.blitzpay_memberships (id) on delete cascade,
  org_invoice_id uuid not null references public.org_invoices (id) on delete cascade,
  billing_period_start date not null,
  billing_period_end date not null,
  generated_by text not null
    check (generated_by in ('scheduler', 'manual', 'renewal')),
  invoice_generation_key text not null,
  created_at timestamptz not null default now(),
  constraint blitzpay_membership_invoices_gen_key unique (organization_id, invoice_generation_key),
  constraint blitzpay_membership_invoices_invoice unique (organization_id, org_invoice_id)
);

comment on table public.blitzpay_membership_invoices is
  'Deterministic link rows between memberships and org_invoices (idempotent generation_key).';

create index if not exists idx_blitzpay_membership_invoices_membership
  on public.blitzpay_membership_invoices (membership_id, created_at desc);

create index if not exists idx_blitzpay_membership_invoices_org_invoice
  on public.blitzpay_membership_invoices (organization_id, org_invoice_id);

-- ---------------------------------------------------------------------------
-- 3) Failed recurring payment / recovery queue (no Stripe ids stored here)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_membership_payment_failures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  membership_id uuid not null references public.blitzpay_memberships (id) on delete cascade,
  org_invoice_id uuid references public.org_invoices (id) on delete set null,
  failure_stage text not null default 'invoice_due'
    check (failure_stage in ('invoice_due', 'autopay', 'manual_retry', 'closed')),
  retry_count integer not null default 0 check (retry_count >= 0 and retry_count <= 20),
  next_retry_at timestamptz,
  last_failure_message text,
  recovery_status text not null default 'open'
    check (recovery_status in ('open', 'recovered', 'written_off', 'superseded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_membership_payment_failures is
  'Bounded retry queue metadata for membership-linked invoices (deterministic retry schedule in app code).';

create index if not exists idx_blitzpay_membership_failures_retry
  on public.blitzpay_membership_payment_failures (organization_id, recovery_status, next_retry_at);

create index if not exists idx_blitzpay_membership_failures_membership
  on public.blitzpay_membership_payment_failures (membership_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4) Append-only membership events (cron + staff actions)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_membership_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  membership_id uuid not null references public.blitzpay_memberships (id) on delete cascade,
  event_type text not null check (char_length(trim(event_type)) > 0),
  event_summary text not null default '' check (char_length(trim(event_summary)) >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_membership_events_org_created
  on public.blitzpay_membership_events (organization_id, created_at desc);

create index if not exists idx_blitzpay_membership_events_membership
  on public.blitzpay_membership_events (membership_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5) Daily retention snapshots (cron-written)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_membership_retention_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  snapshot_date date not null,
  active_memberships integer not null default 0 check (active_memberships >= 0),
  churned_memberships integer not null default 0 check (churned_memberships >= 0),
  mrr_cents bigint not null default 0,
  arr_cents bigint not null default 0,
  delinquent_memberships integer not null default 0 check (delinquent_memberships >= 0),
  renewal_rate_basis_points integer not null default 0 check (renewal_rate_basis_points >= 0 and renewal_rate_basis_points <= 10000),
  auto_pay_adoption_basis_points integer not null default 0 check (auto_pay_adoption_basis_points >= 0 and auto_pay_adoption_basis_points <= 10000),
  created_at timestamptz not null default now(),
  constraint blitzpay_membership_retention_snapshots_org_day unique (organization_id, snapshot_date)
);

create index if not exists idx_blitzpay_membership_retention_org_date
  on public.blitzpay_membership_retention_snapshots (organization_id, snapshot_date desc);

-- Triggers: updated_at
drop trigger if exists trg_blitzpay_memberships_set_updated_at on public.blitzpay_memberships;
create trigger trg_blitzpay_memberships_set_updated_at
before update on public.blitzpay_memberships
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_membership_payment_failures_set_updated_at on public.blitzpay_membership_payment_failures;
create trigger trg_blitzpay_membership_payment_failures_set_updated_at
before update on public.blitzpay_membership_payment_failures
for each row execute function public.set_updated_at();

-- Grants + RLS
revoke all on table public.blitzpay_memberships from public, anon;
revoke all on table public.blitzpay_membership_invoices from public, anon;
revoke all on table public.blitzpay_membership_payment_failures from public, anon;
revoke all on table public.blitzpay_membership_events from public, anon;
revoke all on table public.blitzpay_membership_retention_snapshots from public, anon;

grant select on table public.blitzpay_memberships to authenticated;
grant select on table public.blitzpay_membership_invoices to authenticated;
grant select on table public.blitzpay_membership_payment_failures to authenticated;
grant select on table public.blitzpay_membership_events to authenticated;
grant select on table public.blitzpay_membership_retention_snapshots to authenticated;

alter table public.blitzpay_memberships enable row level security;
alter table public.blitzpay_memberships force row level security;
alter table public.blitzpay_membership_invoices enable row level security;
alter table public.blitzpay_membership_invoices force row level security;
alter table public.blitzpay_membership_payment_failures enable row level security;
alter table public.blitzpay_membership_payment_failures force row level security;
alter table public.blitzpay_membership_events enable row level security;
alter table public.blitzpay_membership_events force row level security;
alter table public.blitzpay_membership_retention_snapshots enable row level security;
alter table public.blitzpay_membership_retention_snapshots force row level security;

drop policy if exists "blitzpay_memberships_select_member" on public.blitzpay_memberships;
create policy "blitzpay_memberships_select_member"
on public.blitzpay_memberships
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "blitzpay_membership_invoices_select_member" on public.blitzpay_membership_invoices;
create policy "blitzpay_membership_invoices_select_member"
on public.blitzpay_membership_invoices
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "blitzpay_membership_payment_failures_select_member" on public.blitzpay_membership_payment_failures;
create policy "blitzpay_membership_payment_failures_select_member"
on public.blitzpay_membership_payment_failures
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "blitzpay_membership_events_select_member" on public.blitzpay_membership_events;
create policy "blitzpay_membership_events_select_member"
on public.blitzpay_membership_events
for select
to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "blitzpay_membership_retention_snapshots_select_member" on public.blitzpay_membership_retention_snapshots;
create policy "blitzpay_membership_retention_snapshots_select_member"
on public.blitzpay_membership_retention_snapshots
for select
to authenticated
using (public.is_org_member (organization_id));
