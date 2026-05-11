-- BlitzPay Phase 1 — Stripe Connect Express onboarding (org-level fields only).
-- SaaS subscription billing continues to use organization_subscriptions + /api/stripe/webhook.

-- Idempotency for BlitzPay Stripe webhooks (separate from public.stripe_webhook_events).
create table if not exists public.blitzpay_stripe_webhook_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

comment on table public.blitzpay_stripe_webhook_events is
  'Stripe Connect evt_* ids for POST /api/blitzpay/webhook; insert-before-process prevents duplicate handling.';

revoke all on table public.blitzpay_stripe_webhook_events from public, anon, authenticated;

alter table public.blitzpay_stripe_webhook_events enable row level security;
alter table public.blitzpay_stripe_webhook_events force row level security;

-- Organization Connect profile (Express account id + normalized onboarding gates).
alter table public.organizations
  add column if not exists stripe_connect_account_id text,
  add column if not exists stripe_connect_status text not null default 'not_started'
    check (
      stripe_connect_status in (
        'not_started',
        'onboarding_started',
        'action_required',
        'pending_verification',
        'ready',
        'disabled'
      )
    ),
  add column if not exists stripe_connect_onboarding_complete boolean not null default false,
  add column if not exists stripe_charges_enabled boolean not null default false,
  add column if not exists stripe_payouts_enabled boolean not null default false,
  add column if not exists stripe_details_submitted boolean not null default false,
  add column if not exists stripe_requirements_currently_due jsonb not null default '[]'::jsonb,
  add column if not exists stripe_requirements_eventually_due jsonb not null default '[]'::jsonb,
  add column if not exists stripe_requirements_past_due jsonb not null default '[]'::jsonb,
  add column if not exists last_stripe_connect_sync_at timestamptz;

comment on column public.organizations.stripe_connect_account_id is
  'Stripe Connect Express account id (acct_*) for BlitzPay; platform secret key only at runtime.';

comment on column public.organizations.stripe_connect_status is
  'BlitzPay Connect onboarding aggregate status derived from Stripe Account + requirements.';

create unique index if not exists idx_organizations_stripe_connect_account_id_unique
  on public.organizations (stripe_connect_account_id)
  where stripe_connect_account_id is not null;
