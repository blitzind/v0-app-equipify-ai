-- BlitzPay Phase 3A — customer billing profiles, saved payment method metadata, autopay enrollments.
-- Stripe remains vault; only safe metadata + hashed references stored here.

create table if not exists public.blitzpay_customer_billing_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'delinquent', 'archived')),
  autopay_enabled boolean not null default false,
  autopay_method_type text
    check (autopay_method_type is null or autopay_method_type in ('card', 'us_bank_account', 'wallet', 'unknown')),
  preferred_invoice_delivery text not null default 'email'
    check (preferred_invoice_delivery in ('email', 'sms', 'manual', 'portal')),
  billing_email text,
  billing_phone text,
  default_payment_method_last4 text,
  default_payment_method_brand text,
  default_payment_method_type text
    check (default_payment_method_type is null or default_payment_method_type in ('card', 'bank_account', 'wallet', 'other')),
  stripe_customer_reference_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, customer_id)
);

create index if not exists idx_blitzpay_billing_profiles_org_status
  on public.blitzpay_customer_billing_profiles (organization_id, status);

create table if not exists public.blitzpay_customer_payment_methods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  billing_profile_id uuid references public.blitzpay_customer_billing_profiles (id) on delete set null,
  payment_method_type text not null
    check (payment_method_type in ('card', 'bank_account', 'wallet', 'other')),
  provider text not null default 'stripe'
    check (provider = 'stripe'),
  provider_reference_hash text not null,
  display_brand text,
  display_last4 text,
  exp_month smallint,
  exp_year smallint,
  is_default boolean not null default false,
  status text not null default 'active'
    check (status in ('active', 'expired', 'removed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider_reference_hash)
);

create index if not exists idx_blitzpay_pm_org_customer
  on public.blitzpay_customer_payment_methods (organization_id, customer_id);

create index if not exists idx_blitzpay_pm_org_status
  on public.blitzpay_customer_payment_methods (organization_id, status);

create table if not exists public.blitzpay_autopay_enrollments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  billing_profile_id uuid not null references public.blitzpay_customer_billing_profiles (id) on delete cascade,
  enrollment_status text not null default 'paused'
    check (enrollment_status in ('active', 'paused', 'canceled', 'failed')),
  enrollment_source text not null default 'admin'
    check (enrollment_source in ('admin', 'customer', 'imported', 'system')),
  payment_timing text not null default 'invoice_due'
    check (payment_timing in ('invoice_due', 'invoice_sent', 'scheduled')),
  scheduled_day smallint
    check (scheduled_day is null or (scheduled_day >= 1 and scheduled_day <= 28)),
  max_charge_amount_cents bigint,
  failure_retry_enabled boolean not null default true,
  failure_retry_count integer not null default 0,
  last_successful_charge_at timestamptz,
  last_failed_charge_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, billing_profile_id)
);

create index if not exists idx_blitzpay_autopay_org_status
  on public.blitzpay_autopay_enrollments (organization_id, enrollment_status);

drop trigger if exists trg_blitzpay_billing_profiles_updated on public.blitzpay_customer_billing_profiles;
create trigger trg_blitzpay_billing_profiles_updated
before update on public.blitzpay_customer_billing_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_pm_updated on public.blitzpay_customer_payment_methods;
create trigger trg_blitzpay_pm_updated
before update on public.blitzpay_customer_payment_methods
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_autopay_updated on public.blitzpay_autopay_enrollments;
create trigger trg_blitzpay_autopay_updated
before update on public.blitzpay_autopay_enrollments
for each row execute function public.set_updated_at();

revoke all on table public.blitzpay_customer_billing_profiles from public, anon;
grant select on table public.blitzpay_customer_billing_profiles to authenticated;

alter table public.blitzpay_customer_billing_profiles enable row level security;
alter table public.blitzpay_customer_billing_profiles force row level security;

drop policy if exists blitzpay_billing_profiles_select_member on public.blitzpay_customer_billing_profiles;
create policy blitzpay_billing_profiles_select_member
on public.blitzpay_customer_billing_profiles
for select
to authenticated
using (public.is_org_member (organization_id));

revoke all on table public.blitzpay_customer_payment_methods from public, anon;
grant select on table public.blitzpay_customer_payment_methods to authenticated;

alter table public.blitzpay_customer_payment_methods enable row level security;
alter table public.blitzpay_customer_payment_methods force row level security;

drop policy if exists blitzpay_pm_select_member on public.blitzpay_customer_payment_methods;
create policy blitzpay_pm_select_member
on public.blitzpay_customer_payment_methods
for select
to authenticated
using (public.is_org_member (organization_id));

revoke all on table public.blitzpay_autopay_enrollments from public, anon;
grant select on table public.blitzpay_autopay_enrollments to authenticated;

alter table public.blitzpay_autopay_enrollments enable row level security;
alter table public.blitzpay_autopay_enrollments force row level security;

drop policy if exists blitzpay_autopay_select_member on public.blitzpay_autopay_enrollments;
create policy blitzpay_autopay_select_member
on public.blitzpay_autopay_enrollments
for select
to authenticated
using (public.is_org_member (organization_id));
