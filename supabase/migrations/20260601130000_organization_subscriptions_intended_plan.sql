-- Paid plan the customer selected (e.g. onboarding) while trial access uses plan_id = scale.
alter table public.organization_subscriptions
  add column if not exists intended_plan_id text;

comment on column public.organization_subscriptions.intended_plan_id is
  'Commercial plan intended after trial (solo/core/growth/scale). Cleared when a Stripe subscription is synced.';
