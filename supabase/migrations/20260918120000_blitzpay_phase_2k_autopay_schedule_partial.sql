-- BlitzPay Phase 2K — autopay consent metadata, scheduled invoice payments, partial payment settings.

alter table public.blitzpay_org_settings
  add column if not exists blitzpay_partial_payments_enabled boolean not null default false,
  add column if not exists blitzpay_partial_payment_min_cents integer not null default 50
    check (blitzpay_partial_payment_min_cents >= 50 and blitzpay_partial_payment_min_cents <= 100000000),
  add column if not exists blitzpay_platform_partial_payments_allowed boolean not null default true,
  add column if not exists blitzpay_scheduled_payments_enabled boolean not null default true;

alter table public.blitzpay_customer_payment_profiles
  add column if not exists autopay_authorization_status text not null default 'none'
    check (autopay_authorization_status in ('none', 'active', 'revoked')),
  add column if not exists autopay_authorized_method_type text
    check (autopay_authorized_method_type is null or autopay_authorized_method_type in ('card', 'us_bank_account')),
  add column if not exists autopay_consent_at timestamptz,
  add column if not exists autopay_consent_source text,
  add column if not exists autopay_consent_copy_version text,
  add column if not exists autopay_revoked_at timestamptz;

alter table public.blitzpay_invoice_payment_attempts
  drop constraint if exists blitzpay_invoice_payment_attempts_channel_check;

alter table public.blitzpay_invoice_payment_attempts
  add constraint blitzpay_invoice_payment_attempts_channel_check
  check (channel in ('checkout', 'payment_element', 'portal_link', 'scheduled_off_session'));

create table if not exists public.blitzpay_autopay_consent_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  action text not null
    check (action in ('authorized', 'revoked', 'renewed')),
  method_type text
    check (method_type is null or method_type in ('card', 'us_bank_account')),
  source text not null,
  copy_version text,
  actor_kind text not null default 'system'
    check (actor_kind in ('system', 'customer', 'staff')),
  actor_user_id uuid references auth.users (id) on delete set null,
  portal_user_id uuid references public.portal_users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_autopay_consent_events_org_customer
  on public.blitzpay_autopay_consent_events (organization_id, customer_id, created_at desc);

create table if not exists public.blitzpay_scheduled_invoice_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  org_invoice_id uuid not null references public.org_invoices (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  invoice_portion_cents integer not null check (invoice_portion_cents >= 50),
  scheduled_for timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'succeeded', 'failed', 'cancelled')),
  execution_idempotency_key text not null,
  created_by_kind text not null
    check (created_by_kind in ('customer_portal', 'staff_dashboard')),
  portal_user_id uuid references public.portal_users (id) on delete set null,
  created_by_user_id uuid references auth.users (id) on delete set null,
  schedule_consent_acknowledged boolean not null default false,
  blitzpay_payment_intent_id uuid references public.blitzpay_payment_intents (id) on delete set null,
  last_error text,
  cancelled_at timestamptz,
  cancel_reason text,
  processed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, execution_idempotency_key)
);

create index if not exists idx_blitzpay_scheduled_invoice_payments_due
  on public.blitzpay_scheduled_invoice_payments (organization_id, status, scheduled_for);

create index if not exists idx_blitzpay_scheduled_invoice_payments_invoice
  on public.blitzpay_scheduled_invoice_payments (organization_id, org_invoice_id, created_at desc);

revoke all on table public.blitzpay_autopay_consent_events from public, anon;
revoke all on table public.blitzpay_scheduled_invoice_payments from public, anon;

grant select on table public.blitzpay_autopay_consent_events to authenticated;
grant select on table public.blitzpay_scheduled_invoice_payments to authenticated;

alter table public.blitzpay_autopay_consent_events enable row level security;
alter table public.blitzpay_autopay_consent_events force row level security;

alter table public.blitzpay_scheduled_invoice_payments enable row level security;
alter table public.blitzpay_scheduled_invoice_payments force row level security;

drop policy if exists "blitzpay_autopay_consent_events_select_member" on public.blitzpay_autopay_consent_events;
create policy "blitzpay_autopay_consent_events_select_member"
on public.blitzpay_autopay_consent_events
for select to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "blitzpay_scheduled_invoice_payments_select_member" on public.blitzpay_scheduled_invoice_payments;
create policy "blitzpay_scheduled_invoice_payments_select_member"
on public.blitzpay_scheduled_invoice_payments
for select to authenticated
using (public.is_org_member (organization_id));

alter table public.blitzpay_collections_timeline
  drop constraint if exists blitzpay_collections_timeline_event_type_check;

alter table public.blitzpay_collections_timeline
  add constraint blitzpay_collections_timeline_event_type_check
  check (event_type in (
    'reminder_scheduled',
    'reminder_sent',
    'reminder_skipped',
    'recovery_stage_changed',
    'payment_link_created',
    'payment_link_used',
    'scheduled_payment_created',
    'scheduled_payment_failed',
    'scheduled_payment_cancelled',
    'autopay_consent_recorded'
  ));
