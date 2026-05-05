-- Idempotency for Stripe webhooks: each Stripe event id is processed at most once.

create table if not exists public.stripe_webhook_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

comment on table public.stripe_webhook_events is
  'Stripe evt_* ids; insert-before-process prevents duplicate handling on retries.';

revoke all on table public.stripe_webhook_events from public, anon, authenticated;

alter table public.stripe_webhook_events enable row level security;
alter table public.stripe_webhook_events force row level security;
