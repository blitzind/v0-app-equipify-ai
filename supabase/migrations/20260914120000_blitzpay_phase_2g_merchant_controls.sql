-- BlitzPay Phase 2G — merchant controls (convenience fee config / disclosure)

alter table public.blitzpay_org_settings
  add column if not exists blitzpay_pass_processing_fees_to_customer boolean not null default false,
  add column if not exists blitzpay_fee_mode text not null default 'merchant_absorbs',
  add column if not exists blitzpay_fee_percentage_snapshot numeric(6,4) not null default 0,
  add column if not exists blitzpay_fee_cap_cents int,
  add column if not exists blitzpay_fee_disclosure_copy text not null default 'A processing fee is applied for online card payments.';

alter table public.blitzpay_org_settings
  drop constraint if exists blitzpay_org_settings_blitzpay_fee_mode_check;

alter table public.blitzpay_org_settings
  add constraint blitzpay_org_settings_blitzpay_fee_mode_check
  check (blitzpay_fee_mode in ('merchant_absorbs', 'customer_pass_through', 'customer_partial_pass_through'));

alter table public.blitzpay_org_settings
  drop constraint if exists blitzpay_org_settings_blitzpay_fee_percentage_snapshot_check;

alter table public.blitzpay_org_settings
  add constraint blitzpay_org_settings_blitzpay_fee_percentage_snapshot_check
  check (blitzpay_fee_percentage_snapshot >= 0 and blitzpay_fee_percentage_snapshot <= 100.0000);

alter table public.blitzpay_org_settings
  drop constraint if exists blitzpay_org_settings_blitzpay_fee_cap_cents_check;

alter table public.blitzpay_org_settings
  add constraint blitzpay_org_settings_blitzpay_fee_cap_cents_check
  check (blitzpay_fee_cap_cents is null or blitzpay_fee_cap_cents >= 0);
