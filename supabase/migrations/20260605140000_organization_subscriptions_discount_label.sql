alter table public.organization_subscriptions
  add column if not exists discount_label text;

comment on column public.organization_subscriptions.discount_label is
  'Short admin-facing label for internal discounts (e.g. shown in billing UI).';
