-- BlitzPay: allow checkout session create before Stripe PaymentIntent id is available.
-- Webhook checkout.session.completed / payment_intent.* backfills stripe_payment_intent_id.

alter table public.blitzpay_payment_intents
  alter column stripe_payment_intent_id drop not null;

drop index if exists public.idx_blitzpay_payment_intents_stripe_pi_unique;

create unique index if not exists idx_blitzpay_payment_intents_stripe_pi_unique
  on public.blitzpay_payment_intents (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
