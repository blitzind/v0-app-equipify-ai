-- Stripe ID columns: NULL means unset; never store empty strings.

update public.organization_subscriptions
set stripe_customer_id = null
where stripe_customer_id is not null
  and btrim(stripe_customer_id) = '';

update public.organization_subscriptions
set stripe_subscription_id = null
where stripe_subscription_id is not null
  and btrim(stripe_subscription_id) = '';

alter table public.organization_subscriptions
  drop constraint if exists organization_subscriptions_stripe_customer_id_nonempty;

alter table public.organization_subscriptions
  add constraint organization_subscriptions_stripe_customer_id_nonempty
  check (stripe_customer_id is null or length(btrim(stripe_customer_id)) > 0);

alter table public.organization_subscriptions
  drop constraint if exists organization_subscriptions_stripe_subscription_id_nonempty;

alter table public.organization_subscriptions
  add constraint organization_subscriptions_stripe_subscription_id_nonempty
  check (stripe_subscription_id is null or length(btrim(stripe_subscription_id)) > 0);
