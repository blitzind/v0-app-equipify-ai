-- BlitzPay Phase 2O — financing provider/session foundations, installment plans, org toggles.
-- No lending decisions; no sensitive application payloads — opaque external refs + non-PII metadata only.

-- ─── Org settings: revenue acceleration flags ───────────────────────────────

alter table public.blitzpay_org_settings
  add column if not exists blitzpay_financing_enabled boolean not null default false;

alter table public.blitzpay_org_settings
  add column if not exists blitzpay_installment_plans_enabled boolean not null default false;

alter table public.blitzpay_org_settings
  add column if not exists blitzpay_financing_monthly_estimate_disclosure text;

comment on column public.blitzpay_org_settings.blitzpay_financing_enabled is
  'Phase 2O: when true, staff/portal may surface financing-ready workflows (provider integrations are separate).';
comment on column public.blitzpay_org_settings.blitzpay_installment_plans_enabled is
  'Phase 2O: org may attach BlitzPay payment plans / staged schedules to quotes or invoices.';
comment on column public.blitzpay_org_settings.blitzpay_financing_monthly_estimate_disclosure is
  'Optional customer-facing copy for illustrative monthly payment estimates (not a credit offer).';

-- ─── Provider catalog (platform-wide, no secrets) ───────────────────────────

create table if not exists public.blitzpay_financing_providers (
  code text primary key,
  display_name text not null,
  integration_stage text not null default 'planned'
    check (integration_stage in ('planned', 'beta', 'live')),
  sort_order int not null default 0,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.blitzpay_financing_providers is
  'Provider-agnostic financing catalog; Equipify does not originate credit.';

insert into public.blitzpay_financing_providers (code, display_name, integration_stage, sort_order, active)
values
  ('wisetack', 'Wisetack', 'planned', 10, false),
  ('hearth', 'Hearth', 'planned', 20, false),
  ('goodleap', 'GoodLeap', 'planned', 30, false),
  ('service_finance', 'Service Finance', 'planned', 40, false),
  ('synchrony', 'Synchrony', 'planned', 50, false),
  ('greensky', 'GreenSky', 'planned', 60, false)
on conflict (code) do nothing;

-- ─── Org × provider enablement ──────────────────────────────────────────────

create table if not exists public.blitzpay_org_financing_providers (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider_code text not null references public.blitzpay_financing_providers (code) on delete cascade,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (organization_id, provider_code)
);

comment on table public.blitzpay_org_financing_providers is
  'Org-level opt-in per financing brand; config holds non-sensitive integration flags only.';

create index if not exists idx_blitzpay_org_financing_providers_org
  on public.blitzpay_org_financing_providers (organization_id);

-- ─── Financing sessions (opaque provider refs only) ─────────────────────────

create table if not exists public.blitzpay_financing_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  org_quote_id uuid references public.org_quotes (id) on delete set null,
  org_invoice_id uuid references public.org_invoices (id) on delete set null,
  provider_code text not null references public.blitzpay_financing_providers (code),
  status text not null default 'financing_available'
    check (
      status in (
        'financing_available',
        'application_started',
        'submitted',
        'approved',
        'declined',
        'funded',
        'contractor_pending_completion',
        'payout_released',
        'canceled'
      )
    ),
  external_session_ref text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_financing_sessions is
  'Financing application/session tracking; never store full provider payloads or PII here.';

create unique index if not exists idx_blitzpay_financing_sessions_idem
  on public.blitzpay_financing_sessions (organization_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_blitzpay_financing_sessions_org_status
  on public.blitzpay_financing_sessions (organization_id, status, created_at desc);

-- ─── Financing offers (optional rows per session) ───────────────────────────

create table if not exists public.blitzpay_financing_offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  session_id uuid not null references public.blitzpay_financing_sessions (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired')),
  amount_cents bigint check (amount_cents is null or amount_cents >= 0),
  currency text not null default 'usd',
  external_offer_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_financing_offers_session
  on public.blitzpay_financing_offers (session_id, created_at desc);

-- ─── Payment plans (invoice / quote / WO anchor) ───────────────────────────

create table if not exists public.blitzpay_payment_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  org_invoice_id uuid references public.org_invoices (id) on delete cascade,
  org_quote_id uuid references public.org_quotes (id) on delete cascade,
  work_order_id uuid references public.work_orders (id) on delete set null,
  plan_kind text not null
    check (plan_kind in ('fixed_count', 'milestone', 'percentage_stages', 'due_schedule')),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'completed', 'canceled')),
  currency text not null default 'usd',
  total_target_cents bigint not null check (total_target_cents >= 0),
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blitzpay_payment_plans_anchor_chk check (
    (org_invoice_id is not null)::int + (org_quote_id is not null)::int >= 1
  )
);

comment on table public.blitzpay_payment_plans is
  'Staged / installment schedules; payments still flow through standard BlitzPay + org_invoice_payments.';

create unique index if not exists idx_blitzpay_payment_plans_idem
  on public.blitzpay_payment_plans (organization_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_blitzpay_payment_plans_org_invoice
  on public.blitzpay_payment_plans (organization_id, org_invoice_id)
  where org_invoice_id is not null;

create index if not exists idx_blitzpay_payment_plans_org_quote
  on public.blitzpay_payment_plans (organization_id, org_quote_id)
  where org_quote_id is not null;

-- ─── Plan installments ──────────────────────────────────────────────────────

create table if not exists public.blitzpay_payment_plan_installments (
  id uuid primary key default gen_random_uuid(),
  payment_plan_id uuid not null references public.blitzpay_payment_plans (id) on delete cascade,
  sequence int not null check (sequence > 0),
  title text not null default '',
  due_on date,
  target_cents bigint not null check (target_cents >= 0),
  percent_bps int check (percent_bps is null or (percent_bps >= 0 and percent_bps <= 10000)),
  status text not null default 'pending'
    check (status in ('pending', 'due', 'paid', 'canceled', 'waived')),
  paid_cents bigint not null default 0 check (paid_cents >= 0),
  org_invoice_payment_id uuid references public.org_invoice_payments (id) on delete set null,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payment_plan_id, sequence)
);

create unique index if not exists idx_blitzpay_plan_installments_pay_idem
  on public.blitzpay_payment_plan_installments (payment_plan_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_blitzpay_plan_installments_plan
  on public.blitzpay_payment_plan_installments (payment_plan_id, sequence);

-- ─── Grants + RLS (authenticated org members; providers table global read) ───

revoke all on public.blitzpay_financing_providers from public, anon;
grant select on public.blitzpay_financing_providers to authenticated, service_role;

alter table public.blitzpay_financing_providers enable row level security;
alter table public.blitzpay_financing_providers force row level security;
drop policy if exists "blitzpay_financing_providers_select_all_members" on public.blitzpay_financing_providers;
create policy "blitzpay_financing_providers_select_all_members"
on public.blitzpay_financing_providers for select to authenticated using (true);

revoke all on public.blitzpay_org_financing_providers from public, anon;
grant select on public.blitzpay_org_financing_providers to authenticated;

alter table public.blitzpay_org_financing_providers enable row level security;
alter table public.blitzpay_org_financing_providers force row level security;
drop policy if exists "blitzpay_org_financing_providers_select_member" on public.blitzpay_org_financing_providers;
create policy "blitzpay_org_financing_providers_select_member"
on public.blitzpay_org_financing_providers for select to authenticated
using (public.is_org_member (organization_id));

revoke all on public.blitzpay_financing_sessions from public, anon;
grant select on public.blitzpay_financing_sessions to authenticated;

alter table public.blitzpay_financing_sessions enable row level security;
alter table public.blitzpay_financing_sessions force row level security;
drop policy if exists "blitzpay_financing_sessions_select_member" on public.blitzpay_financing_sessions;
create policy "blitzpay_financing_sessions_select_member"
on public.blitzpay_financing_sessions for select to authenticated
using (public.is_org_member (organization_id));

revoke all on public.blitzpay_financing_offers from public, anon;
grant select on public.blitzpay_financing_offers to authenticated;

alter table public.blitzpay_financing_offers enable row level security;
alter table public.blitzpay_financing_offers force row level security;
drop policy if exists "blitzpay_financing_offers_select_member" on public.blitzpay_financing_offers;
create policy "blitzpay_financing_offers_select_member"
on public.blitzpay_financing_offers for select to authenticated
using (public.is_org_member (organization_id));

revoke all on public.blitzpay_payment_plans from public, anon;
grant select on public.blitzpay_payment_plans to authenticated;

alter table public.blitzpay_payment_plans enable row level security;
alter table public.blitzpay_payment_plans force row level security;
drop policy if exists "blitzpay_payment_plans_select_member" on public.blitzpay_payment_plans;
create policy "blitzpay_payment_plans_select_member"
on public.blitzpay_payment_plans for select to authenticated
using (public.is_org_member (organization_id));

revoke all on public.blitzpay_payment_plan_installments from public, anon;
grant select on public.blitzpay_payment_plan_installments to authenticated;

alter table public.blitzpay_payment_plan_installments enable row level security;
alter table public.blitzpay_payment_plan_installments force row level security;
drop policy if exists "blitzpay_payment_plan_installments_select_member" on public.blitzpay_payment_plan_installments;
create policy "blitzpay_payment_plan_installments_select_member"
on public.blitzpay_payment_plan_installments for select to authenticated
using (
  exists (
    select 1
    from public.blitzpay_payment_plans p
    where p.id = payment_plan_id
      and public.is_org_member (p.organization_id)
  )
);

-- Service role (API routes) bypasses RLS but still needs table grants.
grant all on public.blitzpay_org_financing_providers to service_role;
grant all on public.blitzpay_financing_sessions to service_role;
grant all on public.blitzpay_financing_offers to service_role;
grant all on public.blitzpay_payment_plans to service_role;
grant all on public.blitzpay_payment_plan_installments to service_role;
