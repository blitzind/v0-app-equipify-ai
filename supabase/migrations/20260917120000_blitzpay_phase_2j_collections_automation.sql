-- BlitzPay Phase 2J — automated collections, payment recovery, hosted payment links.

create table if not exists public.blitzpay_payment_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  org_invoice_id uuid not null references public.org_invoices (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  created_by_user_id uuid references auth.users (id) on delete set null,
  token_hash text not null unique,
  token_version int not null default 1,
  status text not null default 'active'
    check (status in ('active', 'revoked', 'expired')),
  expires_at timestamptz,
  revoked_at timestamptz,
  use_count int not null default 0 check (use_count >= 0),
  last_used_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_payment_links_org_invoice_created
  on public.blitzpay_payment_links (organization_id, org_invoice_id, created_at desc);

create table if not exists public.blitzpay_payment_reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  org_invoice_id uuid not null references public.org_invoices (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  reminder_kind text not null
    check (reminder_kind in ('before_due', 'due_date', 'overdue_3', 'overdue_7', 'overdue_14', 'recovery_followup')),
  channel text not null
    check (channel in ('email', 'sms_future')),
  scheduled_for timestamptz not null,
  dispatch_status text not null default 'pending'
    check (dispatch_status in ('pending', 'sent', 'skipped', 'failed', 'cancelled')),
  send_after timestamptz,
  sent_at timestamptz,
  skip_reason text,
  delivery_status text,
  payment_link_id uuid references public.blitzpay_payment_links (id) on delete set null,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create index if not exists idx_blitzpay_payment_reminders_dispatch
  on public.blitzpay_payment_reminders (dispatch_status, scheduled_for);

create index if not exists idx_blitzpay_payment_reminders_invoice
  on public.blitzpay_payment_reminders (organization_id, org_invoice_id, created_at desc);

create table if not exists public.blitzpay_reminder_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  trigger text not null check (trigger in ('cron', 'manual')),
  status text not null check (status in ('started', 'success', 'failed')),
  reminders_evaluated int not null default 0 check (reminders_evaluated >= 0),
  reminders_sent int not null default 0 check (reminders_sent >= 0),
  reminders_skipped int not null default 0 check (reminders_skipped >= 0),
  summary jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_blitzpay_reminder_runs_org_created
  on public.blitzpay_reminder_runs (organization_id, created_at desc);

create table if not exists public.blitzpay_recovery_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  org_invoice_id uuid not null references public.org_invoices (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  stage text not null
    check (stage in ('monitoring', 'first_reminder', 'second_reminder', 'escalated', 'resolved')),
  status text not null
    check (status in ('open', 'paused', 'resolved')),
  reason text not null
    check (reason in ('failed_payment', 'abandoned_checkout', 'overdue_invoice')),
  last_reminder_at timestamptz,
  last_attempt_at timestamptz,
  last_attempt_status text,
  recommendation text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, org_invoice_id)
);

create index if not exists idx_blitzpay_recovery_cases_org_status
  on public.blitzpay_recovery_cases (organization_id, status, updated_at desc);

create table if not exists public.blitzpay_collections_timeline (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  org_invoice_id uuid not null references public.org_invoices (id) on delete cascade,
  event_type text not null
    check (event_type in ('reminder_scheduled', 'reminder_sent', 'reminder_skipped', 'recovery_stage_changed', 'payment_link_created', 'payment_link_used')),
  actor_kind text not null default 'system'
    check (actor_kind in ('system', 'staff', 'ai_recommendation')),
  actor_user_id uuid references auth.users (id) on delete set null,
  reminder_id uuid references public.blitzpay_payment_reminders (id) on delete set null,
  recovery_case_id uuid references public.blitzpay_recovery_cases (id) on delete set null,
  payment_link_id uuid references public.blitzpay_payment_links (id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_collections_timeline_org_invoice
  on public.blitzpay_collections_timeline (organization_id, org_invoice_id, created_at desc);

revoke all on table public.blitzpay_payment_links from public, anon;
revoke all on table public.blitzpay_payment_reminders from public, anon;
revoke all on table public.blitzpay_reminder_runs from public, anon;
revoke all on table public.blitzpay_recovery_cases from public, anon;
revoke all on table public.blitzpay_collections_timeline from public, anon;

grant select on table public.blitzpay_payment_links to authenticated;
grant select on table public.blitzpay_payment_reminders to authenticated;
grant select on table public.blitzpay_reminder_runs to authenticated;
grant select on table public.blitzpay_recovery_cases to authenticated;
grant select on table public.blitzpay_collections_timeline to authenticated;

alter table public.blitzpay_payment_links enable row level security;
alter table public.blitzpay_payment_links force row level security;
alter table public.blitzpay_payment_reminders enable row level security;
alter table public.blitzpay_payment_reminders force row level security;
alter table public.blitzpay_reminder_runs enable row level security;
alter table public.blitzpay_reminder_runs force row level security;
alter table public.blitzpay_recovery_cases enable row level security;
alter table public.blitzpay_recovery_cases force row level security;
alter table public.blitzpay_collections_timeline enable row level security;
alter table public.blitzpay_collections_timeline force row level security;

drop policy if exists "blitzpay_payment_links_select_member" on public.blitzpay_payment_links;
create policy "blitzpay_payment_links_select_member"
on public.blitzpay_payment_links
for select to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "blitzpay_payment_reminders_select_member" on public.blitzpay_payment_reminders;
create policy "blitzpay_payment_reminders_select_member"
on public.blitzpay_payment_reminders
for select to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "blitzpay_reminder_runs_select_member" on public.blitzpay_reminder_runs;
create policy "blitzpay_reminder_runs_select_member"
on public.blitzpay_reminder_runs
for select to authenticated
using (organization_id is null or public.is_org_member (organization_id));

drop policy if exists "blitzpay_recovery_cases_select_member" on public.blitzpay_recovery_cases;
create policy "blitzpay_recovery_cases_select_member"
on public.blitzpay_recovery_cases
for select to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "blitzpay_collections_timeline_select_member" on public.blitzpay_collections_timeline;
create policy "blitzpay_collections_timeline_select_member"
on public.blitzpay_collections_timeline
for select to authenticated
using (public.is_org_member (organization_id));
