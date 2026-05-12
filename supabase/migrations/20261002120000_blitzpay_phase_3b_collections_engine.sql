-- BlitzPay Phase 3B — invoice collection states, attempts, recovery flows, activity log.
-- Orchestration and metadata only; Stripe remains payment authority; no autonomous charges.

create table if not exists public.blitzpay_invoice_collection_states (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  invoice_id uuid not null references public.org_invoices (id) on delete cascade,
  customer_id uuid not null,
  billing_profile_id uuid references public.blitzpay_customer_billing_profiles (id) on delete set null,
  collection_status text not null default 'current'
    check (
      collection_status in (
        'current',
        'upcoming',
        'due',
        'retry_scheduled',
        'retry_in_progress',
        'partial_payment',
        'failed',
        'escalated',
        'resolved',
        'uncollectible'
      )
    ),
  payment_attempt_count integer not null default 0 check (payment_attempt_count >= 0),
  failed_attempt_count integer not null default 0 check (failed_attempt_count >= 0),
  next_retry_at timestamptz,
  last_attempted_at timestamptz,
  last_successful_payment_at timestamptz,
  last_failure_reason text,
  last_failure_category text,
  escalation_level integer not null default 0 check (escalation_level >= 0 and escalation_level <= 10),
  autopay_enabled boolean not null default false,
  recovery_paused boolean not null default false,
  first_failure_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, invoice_id),
  constraint blitzpay_coll_state_customer_fkey
    foreign key (organization_id, customer_id)
    references public.customers (organization_id, id)
    on delete cascade
);

create index if not exists idx_blitzpay_coll_state_org_status
  on public.blitzpay_invoice_collection_states (organization_id, collection_status);

create index if not exists idx_blitzpay_coll_state_org_customer
  on public.blitzpay_invoice_collection_states (organization_id, customer_id);

create index if not exists idx_blitzpay_coll_state_org_next_retry
  on public.blitzpay_invoice_collection_states (organization_id, next_retry_at)
  where next_retry_at is not null;

create table if not exists public.blitzpay_collection_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  invoice_id uuid not null references public.org_invoices (id) on delete cascade,
  customer_id uuid not null,
  collection_state_id uuid not null references public.blitzpay_invoice_collection_states (id) on delete cascade,
  attempt_type text not null
    check (
      attempt_type in (
        'autopay',
        'manual_retry',
        'scheduled_retry',
        'reminder',
        'escalation',
        'settlement'
      )
    ),
  attempt_status text not null default 'queued'
    check (
      attempt_status in (
        'queued',
        'processing',
        'succeeded',
        'failed',
        'canceled',
        'skipped'
      )
    ),
  provider text not null default 'stripe'
    check (provider = 'stripe'),
  provider_reference_hash text,
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  currency text not null default 'usd',
  failure_reason text,
  failure_category text,
  retry_eligible boolean not null default true,
  initiated_by uuid references auth.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  attempted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint blitzpay_coll_attempts_customer_fkey
    foreign key (organization_id, customer_id)
    references public.customers (organization_id, id)
    on delete cascade
);

create index if not exists idx_blitzpay_coll_attempts_org_invoice
  on public.blitzpay_collection_attempts (organization_id, invoice_id, attempted_at desc);

create index if not exists idx_blitzpay_coll_attempts_state
  on public.blitzpay_collection_attempts (collection_state_id, attempted_at desc);

create table if not exists public.blitzpay_collection_recovery_flows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null,
  invoice_id uuid references public.org_invoices (id) on delete cascade,
  flow_status text not null default 'active'
    check (flow_status in ('active', 'paused', 'completed', 'canceled')),
  trigger_type text not null
    check (trigger_type in ('failed_payment', 'overdue_invoice', 'partial_payment', 'manual_review')),
  current_stage integer not null default 0 check (current_stage >= 0 and current_stage <= 20),
  max_stage integer not null default 5 check (max_stage >= 0 and max_stage <= 20),
  next_action_at timestamptz,
  last_action_at timestamptz,
  last_action_type text,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blitzpay_recovery_flows_customer_fkey
    foreign key (organization_id, customer_id)
    references public.customers (organization_id, id)
    on delete cascade
);

create index if not exists idx_blitzpay_recovery_flows_org_invoice
  on public.blitzpay_collection_recovery_flows (organization_id, invoice_id);

create index if not exists idx_blitzpay_recovery_flows_org_status
  on public.blitzpay_collection_recovery_flows (organization_id, flow_status);

create table if not exists public.blitzpay_collection_activity_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  invoice_id uuid references public.org_invoices (id) on delete set null,
  customer_id uuid,
  activity_type text not null
    check (
      activity_type in (
        'reminder_sent',
        'retry_scheduled',
        'retry_attempted',
        'payment_collected',
        'escalation_triggered',
        'flow_paused',
        'flow_resumed',
        'marked_uncollectible',
        'manual_resolution'
      )
    ),
  activity_summary text not null,
  actor_type text not null default 'system'
    check (actor_type in ('system', 'admin', 'customer')),
  actor_id uuid references auth.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_coll_activity_org_created
  on public.blitzpay_collection_activity_log (organization_id, created_at desc);

drop trigger if exists trg_blitzpay_coll_state_updated on public.blitzpay_invoice_collection_states;
create trigger trg_blitzpay_coll_state_updated
before update on public.blitzpay_invoice_collection_states
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_recovery_flow_updated on public.blitzpay_collection_recovery_flows;
create trigger trg_blitzpay_recovery_flow_updated
before update on public.blitzpay_collection_recovery_flows
for each row execute function public.set_updated_at();

revoke all on table public.blitzpay_invoice_collection_states from public, anon;
grant select on table public.blitzpay_invoice_collection_states to authenticated;

alter table public.blitzpay_invoice_collection_states enable row level security;
alter table public.blitzpay_invoice_collection_states force row level security;

drop policy if exists blitzpay_coll_state_select_member on public.blitzpay_invoice_collection_states;
create policy blitzpay_coll_state_select_member
on public.blitzpay_invoice_collection_states
for select
to authenticated
using (public.is_org_member (organization_id));

revoke all on table public.blitzpay_collection_attempts from public, anon;
grant select on table public.blitzpay_collection_attempts to authenticated;

alter table public.blitzpay_collection_attempts enable row level security;
alter table public.blitzpay_collection_attempts force row level security;

drop policy if exists blitzpay_coll_attempts_select_member on public.blitzpay_collection_attempts;
create policy blitzpay_coll_attempts_select_member
on public.blitzpay_collection_attempts
for select
to authenticated
using (public.is_org_member (organization_id));

revoke all on table public.blitzpay_collection_recovery_flows from public, anon;
grant select on table public.blitzpay_collection_recovery_flows to authenticated;

alter table public.blitzpay_collection_recovery_flows enable row level security;
alter table public.blitzpay_collection_recovery_flows force row level security;

drop policy if exists blitzpay_recovery_flows_select_member on public.blitzpay_collection_recovery_flows;
create policy blitzpay_recovery_flows_select_member
on public.blitzpay_collection_recovery_flows
for select
to authenticated
using (public.is_org_member (organization_id));

revoke all on table public.blitzpay_collection_activity_log from public, anon;
grant select on table public.blitzpay_collection_activity_log to authenticated;

alter table public.blitzpay_collection_activity_log enable row level security;
alter table public.blitzpay_collection_activity_log force row level security;

drop policy if exists blitzpay_coll_activity_select_member on public.blitzpay_collection_activity_log;
create policy blitzpay_coll_activity_select_member
on public.blitzpay_collection_activity_log
for select
to authenticated
using (public.is_org_member (organization_id));
