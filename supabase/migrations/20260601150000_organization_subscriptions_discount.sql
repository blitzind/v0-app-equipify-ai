-- Manual platform-admin discounts (internal bookkeeping; Stripe coupon sync is separate).

alter table public.organization_subscriptions
  add column if not exists discount_type text,
  add column if not exists discount_value numeric,
  add column if not exists discount_reason text,
  add column if not exists discount_expires_at timestamptz;

comment on column public.organization_subscriptions.discount_type is
  'percent | fixed | null. Fixed amount is in cents (same unit as lib/plans.ts prices).';

comment on column public.organization_subscriptions.discount_value is
  'Percent off (1–100) or fixed cents off when discount_type matches.';

alter table public.organization_subscriptions
  drop constraint if exists organization_subscriptions_discount_type_check;

alter table public.organization_subscriptions
  add constraint organization_subscriptions_discount_type_check
  check (discount_type is null or discount_type in ('percent', 'fixed'));
