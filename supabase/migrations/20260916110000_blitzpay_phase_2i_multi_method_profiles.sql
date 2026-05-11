-- BlitzPay Phase 2I — multi-method checkout (card + ACH) and stored payment profiles.

alter table public.blitzpay_org_settings
  add column if not exists blitzpay_payment_method_card_enabled boolean not null default true,
  add column if not exists blitzpay_payment_method_ach_enabled boolean not null default false,
  add column if not exists blitzpay_ach_convenience_fee_enabled boolean not null default false,
  add column if not exists blitzpay_ach_processing_timeline_copy text not null default 'Bank (ACH) payments can take 3-5 business days to settle.',
  add column if not exists blitzpay_allow_save_payment_methods boolean not null default true;

alter table public.blitzpay_payment_intents
  add column if not exists payment_method_type text,
  add column if not exists stripe_payment_method_id text,
  add column if not exists stripe_customer_id text,
  add column if not exists save_payment_method_requested boolean not null default false,
  add column if not exists ach_settlement_state text;

alter table public.blitzpay_payment_intents
  drop constraint if exists blitzpay_payment_intents_payment_method_type_check;

alter table public.blitzpay_payment_intents
  add constraint blitzpay_payment_intents_payment_method_type_check
  check (payment_method_type is null or payment_method_type in ('card', 'us_bank_account'));

alter table public.blitzpay_payment_intents
  drop constraint if exists blitzpay_payment_intents_ach_settlement_state_check;

alter table public.blitzpay_payment_intents
  add constraint blitzpay_payment_intents_ach_settlement_state_check
  check (
    ach_settlement_state is null
    or ach_settlement_state in ('pending', 'settled', 'failed')
  );

create table if not exists public.blitzpay_customer_payment_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  stripe_connect_account_id text not null,
  stripe_customer_id text,
  has_default_payment_method boolean not null default false,
  default_payment_method_type text,
  last_used_payment_method_type text,
  save_payment_method_opt_in boolean not null default false,
  off_session_authorized boolean not null default false,
  autopay_eligible boolean not null default false,
  last_blitzpay_payment_intent_id uuid references public.blitzpay_payment_intents (id) on delete set null,
  last_used_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, customer_id)
);

alter table public.blitzpay_customer_payment_profiles
  drop constraint if exists blitzpay_customer_payment_profiles_default_payment_method_type_check;

alter table public.blitzpay_customer_payment_profiles
  add constraint blitzpay_customer_payment_profiles_default_payment_method_type_check
  check (default_payment_method_type is null or default_payment_method_type in ('card', 'us_bank_account'));

alter table public.blitzpay_customer_payment_profiles
  drop constraint if exists blitzpay_customer_payment_profiles_last_used_payment_method_type_check;

alter table public.blitzpay_customer_payment_profiles
  add constraint blitzpay_customer_payment_profiles_last_used_payment_method_type_check
  check (last_used_payment_method_type is null or last_used_payment_method_type in ('card', 'us_bank_account'));

create index if not exists idx_blitzpay_customer_profiles_org_updated
  on public.blitzpay_customer_payment_profiles (organization_id, updated_at desc);

revoke all on table public.blitzpay_customer_payment_profiles from public, anon;
grant select on table public.blitzpay_customer_payment_profiles to authenticated;

alter table public.blitzpay_customer_payment_profiles enable row level security;
alter table public.blitzpay_customer_payment_profiles force row level security;

drop policy if exists "blitzpay_customer_payment_profiles_select_member" on public.blitzpay_customer_payment_profiles;
create policy "blitzpay_customer_payment_profiles_select_member"
on public.blitzpay_customer_payment_profiles
for select
to authenticated
using (public.is_org_member (organization_id));
