-- BlitzPay Phase 6A — Native mobile financial ops foundations (offline capture only; server validation; no offline money movement).
-- Org-scoped RLS; technician-scoped reads where applicable; append-only mobile audit.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regclass('public.profiles') is null then
    raise exception 'Missing dependency: public.profiles';
  end if;
  if to_regprocedure('public.has_org_role(uuid, text[])') is null then
    raise exception 'Missing dependency: public.has_org_role(uuid, text[])';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'Missing dependency: public.set_updated_at()';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mobile financial intents (capture / queue; not authoritative payments)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_mobile_financial_intents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  technician_id uuid references public.profiles (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  work_order_id uuid references public.work_orders (id) on delete set null,
  invoice_id uuid references public.org_invoices (id) on delete set null,
  intent_type text not null
    check (intent_type in (
      'payment_collection', 'customer_signature', 'financing_request', 'claim_intake', 'payroll_review',
      'treasury_note', 'protection_plan_offer', 'custom'
    )),
  intent_status text not null default 'draft'
    check (intent_status in (
      'draft', 'queued', 'synced', 'reviewed', 'approved', 'rejected', 'archived'
    )),
  captured_offline boolean not null default false,
  captured_at timestamptz not null default now(),
  synced_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  amount_cents bigint check (amount_cents is null or amount_cents >= 0),
  currency text not null default 'usd' check (currency = 'usd'),
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_mobile_financial_intents is
  'Offline-safe financial intent capture; server must validate before authoritative records — no payment processing in Phase 6A.';

create index if not exists idx_blitzpay_mobile_intents_org_status
  on public.blitzpay_mobile_financial_intents (organization_id, intent_status);

create index if not exists idx_blitzpay_mobile_intents_org_tech
  on public.blitzpay_mobile_financial_intents (organization_id, technician_id);

-- ---------------------------------------------------------------------------
-- Signature authorizations (hashed references only; no raw signature storage)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_mobile_signature_authorizations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  mobile_intent_id uuid references public.blitzpay_mobile_financial_intents (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  work_order_id uuid references public.work_orders (id) on delete set null,
  invoice_id uuid references public.org_invoices (id) on delete set null,
  authorization_type text not null
    check (authorization_type in (
      'payment_approval', 'ach_authorization_acknowledgment', 'financing_acknowledgment',
      'protection_plan_acknowledgment', 'claim_acknowledgment', 'custom'
    )),
  authorization_status text not null default 'captured'
    check (authorization_status in ('captured', 'synced', 'verified', 'rejected', 'archived')),
  signer_name text,
  signer_email text,
  signature_hash text not null check (char_length(signature_hash) >= 32),
  signed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_mobile_sig_org
  on public.blitzpay_mobile_signature_authorizations (organization_id, authorization_status);

create index if not exists idx_blitzpay_mobile_sig_intent
  on public.blitzpay_mobile_signature_authorizations (mobile_intent_id);

-- ---------------------------------------------------------------------------
-- Mobile payroll approval items (queue foundations; server validates approvals)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_mobile_payroll_approval_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  technician_id uuid references public.profiles (id) on delete set null,
  payroll_run_id uuid references public.blitzpay_payroll_runs (id) on delete set null,
  work_order_id uuid references public.work_orders (id) on delete set null,
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'disputed', 'rejected', 'archived')),
  approval_type text not null
    check (approval_type in (
      'labor_hours', 'commission', 'reimbursement', 'contractor_settlement', 'bonus', 'custom'
    )),
  amount_cents bigint check (amount_cents is null or amount_cents >= 0),
  submitted_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  dispute_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_mobile_payroll_org_status
  on public.blitzpay_mobile_payroll_approval_items (organization_id, approval_status);

-- ---------------------------------------------------------------------------
-- Mobile treasury snapshots (field-safe aggregates per audience band)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_mobile_treasury_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  snapshot_date date not null default (timezone('utc', now()))::date,
  visible_to_role text not null
    check (visible_to_role in ('owner', 'manager', 'field_supervisor', 'technician')),
  available_cash_cents bigint check (available_cash_cents is null or available_cash_cents >= 0),
  upcoming_payables_cents bigint check (upcoming_payables_cents is null or upcoming_payables_cents >= 0),
  upcoming_payroll_cents bigint check (upcoming_payroll_cents is null or upcoming_payroll_cents >= 0),
  collections_due_cents bigint check (collections_due_cents is null or collections_due_cents >= 0),
  treasury_health_score integer
    check (treasury_health_score is null or (treasury_health_score >= 0 and treasury_health_score <= 100)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_mobile_treasury_org_date
  on public.blitzpay_mobile_treasury_snapshots (organization_id, snapshot_date desc, visible_to_role);

-- ---------------------------------------------------------------------------
-- Mobile sync batches (device-scoped metadata; no raw device ids in DB beyond hash)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_mobile_sync_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  batch_status text not null default 'queued'
    check (batch_status in ('queued', 'processing', 'completed', 'partially_failed', 'failed', 'archived')),
  device_reference_hash text check (device_reference_hash is null or char_length(device_reference_hash) >= 16),
  offline_item_count integer not null default 0 check (offline_item_count >= 0),
  processed_item_count integer not null default 0 check (processed_item_count >= 0),
  failed_item_count integer not null default 0 check (failed_item_count >= 0),
  submitted_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_mobile_sync_org
  on public.blitzpay_mobile_sync_batches (organization_id, submitted_at desc);

-- ---------------------------------------------------------------------------
-- Mobile audit log (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_mobile_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sync_batch_id uuid references public.blitzpay_mobile_sync_batches (id) on delete set null,
  mobile_intent_id uuid references public.blitzpay_mobile_financial_intents (id) on delete set null,
  audit_type text not null
    check (audit_type in (
      'intent_captured', 'intent_synced', 'signature_captured', 'payroll_item_reviewed', 'treasury_snapshot_viewed',
      'sync_batch_processed', 'conflict_detected', 'manual_override'
    )),
  actor_type text not null check (actor_type in ('system', 'admin', 'user', 'technician')),
  actor_id uuid references public.profiles (id) on delete set null,
  audit_summary text not null,
  immutable_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_mobile_audit_org
  on public.blitzpay_mobile_audit_log (organization_id, created_at desc);

create or replace function public.blitzpay_mobile_audit_block_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'blitzpay_mobile_audit_immutable';
end;
$$;

drop trigger if exists trg_blitzpay_mobile_audit_block_update on public.blitzpay_mobile_audit_log;
create trigger trg_blitzpay_mobile_audit_block_update
before update on public.blitzpay_mobile_audit_log
for each row execute function public.blitzpay_mobile_audit_block_mutation();

drop trigger if exists trg_blitzpay_mobile_audit_block_delete on public.blitzpay_mobile_audit_log;
create trigger trg_blitzpay_mobile_audit_block_delete
before delete on public.blitzpay_mobile_audit_log
for each row execute function public.blitzpay_mobile_audit_block_mutation();

-- ---------------------------------------------------------------------------
-- updated_at triggers (mutable staff tables)
-- ---------------------------------------------------------------------------
drop trigger if exists trg_blitzpay_mobile_intents_updated on public.blitzpay_mobile_financial_intents;
create trigger trg_blitzpay_mobile_intents_updated
before update on public.blitzpay_mobile_financial_intents
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_mobile_sig_updated on public.blitzpay_mobile_signature_authorizations;
create trigger trg_blitzpay_mobile_sig_updated
before update on public.blitzpay_mobile_signature_authorizations
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_mobile_payroll_updated on public.blitzpay_mobile_payroll_approval_items;
create trigger trg_blitzpay_mobile_payroll_updated
before update on public.blitzpay_mobile_payroll_approval_items
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_mobile_sync_updated on public.blitzpay_mobile_sync_batches;
create trigger trg_blitzpay_mobile_sync_updated
before update on public.blitzpay_mobile_sync_batches
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
revoke all on table public.blitzpay_mobile_financial_intents from public, anon;
revoke all on table public.blitzpay_mobile_signature_authorizations from public, anon;
revoke all on table public.blitzpay_mobile_payroll_approval_items from public, anon;
revoke all on table public.blitzpay_mobile_treasury_snapshots from public, anon;
revoke all on table public.blitzpay_mobile_sync_batches from public, anon;
revoke all on table public.blitzpay_mobile_audit_log from public, anon;

grant select on table public.blitzpay_mobile_financial_intents to authenticated;
grant select on table public.blitzpay_mobile_signature_authorizations to authenticated;
grant select on table public.blitzpay_mobile_payroll_approval_items to authenticated;
grant select on table public.blitzpay_mobile_treasury_snapshots to authenticated;
grant select on table public.blitzpay_mobile_sync_batches to authenticated;
grant select on table public.blitzpay_mobile_audit_log to authenticated;

alter table public.blitzpay_mobile_financial_intents enable row level security;
alter table public.blitzpay_mobile_financial_intents force row level security;
alter table public.blitzpay_mobile_signature_authorizations enable row level security;
alter table public.blitzpay_mobile_signature_authorizations force row level security;
alter table public.blitzpay_mobile_payroll_approval_items enable row level security;
alter table public.blitzpay_mobile_payroll_approval_items force row level security;
alter table public.blitzpay_mobile_treasury_snapshots enable row level security;
alter table public.blitzpay_mobile_treasury_snapshots force row level security;
alter table public.blitzpay_mobile_sync_batches enable row level security;
alter table public.blitzpay_mobile_sync_batches force row level security;
alter table public.blitzpay_mobile_audit_log enable row level security;
alter table public.blitzpay_mobile_audit_log force row level security;

-- Intents: finance roles see org; technicians see own rows only.
drop policy if exists "blitzpay_mobile_intents_select_finance" on public.blitzpay_mobile_financial_intents;
create policy "blitzpay_mobile_intents_select_finance"
on public.blitzpay_mobile_financial_intents for select to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_mobile_intents_select_tech_own" on public.blitzpay_mobile_financial_intents;
create policy "blitzpay_mobile_intents_select_tech_own"
on public.blitzpay_mobile_financial_intents for select to authenticated
using (
  public.has_org_role (organization_id, array['tech']::text[])
  and technician_id is not null
  and technician_id = (select auth.uid())
);

-- Signatures: finance roles OR technician with owning intent.
drop policy if exists "blitzpay_mobile_sig_select_finance" on public.blitzpay_mobile_signature_authorizations;
create policy "blitzpay_mobile_sig_select_finance"
on public.blitzpay_mobile_signature_authorizations for select to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_mobile_sig_select_tech_intent" on public.blitzpay_mobile_signature_authorizations;
create policy "blitzpay_mobile_sig_select_tech_intent"
on public.blitzpay_mobile_signature_authorizations for select to authenticated
using (
  public.has_org_role (organization_id, array['tech']::text[])
  and exists (
    select 1
    from public.blitzpay_mobile_financial_intents i
    where i.id = mobile_intent_id
      and i.organization_id = blitzpay_mobile_signature_authorizations.organization_id
      and i.technician_id is not null
      and i.technician_id = (select auth.uid())
  )
);

-- Payroll items: finance roles OR technician own pending/review rows.
drop policy if exists "blitzpay_mobile_payroll_select_finance" on public.blitzpay_mobile_payroll_approval_items;
create policy "blitzpay_mobile_payroll_select_finance"
on public.blitzpay_mobile_payroll_approval_items for select to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_mobile_payroll_select_tech_own" on public.blitzpay_mobile_payroll_approval_items;
create policy "blitzpay_mobile_payroll_select_tech_own"
on public.blitzpay_mobile_payroll_approval_items for select to authenticated
using (
  public.has_org_role (organization_id, array['tech']::text[])
  and technician_id is not null
  and technician_id = (select auth.uid())
);

-- Treasury snapshots: finance sees all bands; technicians only technician band.
drop policy if exists "blitzpay_mobile_treasury_select_finance" on public.blitzpay_mobile_treasury_snapshots;
create policy "blitzpay_mobile_treasury_select_finance"
on public.blitzpay_mobile_treasury_snapshots for select to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_mobile_treasury_select_tech" on public.blitzpay_mobile_treasury_snapshots;
create policy "blitzpay_mobile_treasury_select_tech"
on public.blitzpay_mobile_treasury_snapshots for select to authenticated
using (
  public.has_org_role (organization_id, array['tech']::text[])
  and visible_to_role = 'technician'
);

-- Sync batches: finance org-wide; submitter sees own batches.
drop policy if exists "blitzpay_mobile_sync_select_finance" on public.blitzpay_mobile_sync_batches;
create policy "blitzpay_mobile_sync_select_finance"
on public.blitzpay_mobile_sync_batches for select to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_mobile_sync_select_owner_user" on public.blitzpay_mobile_sync_batches;
create policy "blitzpay_mobile_sync_select_owner_user"
on public.blitzpay_mobile_sync_batches for select to authenticated
using (
  user_id is not null
  and user_id = (select auth.uid())
);

-- Mobile audit: finance OR technician with linked intent owned by caller.
drop policy if exists "blitzpay_mobile_audit_select_finance" on public.blitzpay_mobile_audit_log;
create policy "blitzpay_mobile_audit_select_finance"
on public.blitzpay_mobile_audit_log for select to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_mobile_audit_select_tech_intent" on public.blitzpay_mobile_audit_log;
create policy "blitzpay_mobile_audit_select_tech_intent"
on public.blitzpay_mobile_audit_log for select to authenticated
using (
  public.has_org_role (organization_id, array['tech']::text[])
  and mobile_intent_id is not null
  and exists (
    select 1
    from public.blitzpay_mobile_financial_intents i
    where i.id = mobile_intent_id
      and i.organization_id = blitzpay_mobile_audit_log.organization_id
      and i.technician_id is not null
      and i.technician_id = (select auth.uid())
  )
);
