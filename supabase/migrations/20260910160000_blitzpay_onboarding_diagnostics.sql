-- BlitzPay — last Connect onboarding attempt diagnostics (support / future admin; no secrets).

alter table public.organizations
  add column if not exists blitzpay_last_onboarding_attempt_at timestamptz,
  add column if not exists blitzpay_last_onboarding_failure_at timestamptz,
  add column if not exists blitzpay_last_onboarding_error_category text,
  add column if not exists blitzpay_last_stripe_request_id text;

comment on column public.organizations.blitzpay_last_onboarding_attempt_at is
  'Last BlitzPay Connect onboarding-related API attempt (success clears failure fields).';

comment on column public.organizations.blitzpay_last_onboarding_failure_at is
  'When the last BlitzPay Connect onboarding Stripe/API failure occurred.';

comment on column public.organizations.blitzpay_last_onboarding_error_category is
  'Normalized error code (e.g. connect_rate_limited); not raw Stripe message.';

comment on column public.organizations.blitzpay_last_stripe_request_id is
  'Stripe request id (req_*) from last failed onboarding call for support correlation.';

create index if not exists idx_organizations_blitzpay_last_failure
  on public.organizations (blitzpay_last_onboarding_failure_at desc)
  where blitzpay_last_onboarding_failure_at is not null;
