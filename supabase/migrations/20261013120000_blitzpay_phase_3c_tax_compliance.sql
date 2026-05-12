-- BlitzPay Phase 3C — Tax & compliance engine foundations (calculations + audit orchestration only; no filing/remittance).
-- Org-scoped jurisdictions, rules, calculations, compliance audit (append-only), ACH auth tracking, vendor tax profiles, liability snapshots.
-- RLS: owner/admin/manager read; writes via service-role Route Handlers only.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regclass('public.blitzpay_vendors') is null then
    raise exception 'Missing dependency: public.blitzpay_vendors (Phase 3B AP)';
  end if;
  if to_regclass('public.customers') is null then
    raise exception 'Missing dependency: public.customers';
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
-- Tax jurisdictions
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_tax_jurisdictions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  jurisdiction_name text not null,
  jurisdiction_type text not null default 'state'
    check (jurisdiction_type in (
      'federal', 'state', 'county', 'city', 'district', 'international'
    )),
  jurisdiction_code text,
  country_code text not null default 'US',
  region_code text,
  tax_status text not null default 'active'
    check (tax_status in ('active', 'inactive', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blitzpay_tax_jurisdictions_org_name unique (organization_id, jurisdiction_name)
);

comment on table public.blitzpay_tax_jurisdictions is
  'Contractor tax jurisdiction configuration; not legal advice.';

create index if not exists idx_blitzpay_tax_jurisdictions_org_status
  on public.blitzpay_tax_jurisdictions (organization_id, tax_status);

-- ---------------------------------------------------------------------------
-- Tax rules
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_tax_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  jurisdiction_id uuid not null references public.blitzpay_tax_jurisdictions (id) on delete restrict,
  tax_rule_name text not null,
  tax_rule_type text not null default 'sales_tax'
    check (tax_rule_type in (
      'sales_tax', 'payroll_tax', 'convenience_fee', 'contractor_tax', 'excise', 'custom'
    )),
  calculation_method text not null default 'percentage'
    check (calculation_method in ('percentage', 'flat', 'threshold', 'tiered')),
  rate_basis_points integer check (rate_basis_points is null or (rate_basis_points >= 0 and rate_basis_points <= 1000000)),
  flat_amount_cents bigint check (flat_amount_cents is null or flat_amount_cents >= 0),
  threshold_amount_cents bigint check (threshold_amount_cents is null or threshold_amount_cents >= 0),
  applies_to text not null default 'invoice'
    check (applies_to in (
      'invoice', 'membership', 'labor', 'equipment', 'materials', 'processing_fee',
      'payroll', 'vendor_bill', 'custom'
    )),
  effective_start_date date not null,
  effective_end_date date,
  compliance_status text not null default 'active'
    check (compliance_status in ('active', 'pending_review', 'deprecated', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blitzpay_tax_rules_effective_dates check (
    effective_end_date is null or effective_end_date >= effective_start_date
  )
);

comment on table public.blitzpay_tax_rules is
  'Deterministic tax rule rows; archived rows are immutable (trigger).';

create index if not exists idx_blitzpay_tax_rules_org_jurisdiction
  on public.blitzpay_tax_rules (organization_id, jurisdiction_id, compliance_status);

-- ---------------------------------------------------------------------------
-- Tax calculations (immutable rows — append adjustments as new rows with status adjusted)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_tax_calculations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  jurisdiction_id uuid not null references public.blitzpay_tax_jurisdictions (id) on delete restrict,
  tax_rule_id uuid references public.blitzpay_tax_rules (id) on delete set null,
  taxable_amount_cents bigint not null check (taxable_amount_cents >= 0),
  calculated_tax_cents bigint not null check (calculated_tax_cents >= 0),
  effective_rate_basis_points integer,
  calculation_status text not null default 'estimated'
    check (calculation_status in ('estimated', 'finalized', 'adjusted', 'voided')),
  calculation_date date not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_tax_calculations_org_date
  on public.blitzpay_tax_calculations (organization_id, calculation_date desc);

-- ---------------------------------------------------------------------------
-- Compliance audit log (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_compliance_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  audit_type text not null
    check (audit_type in (
      'tax_rule_change', 'tax_calculation', 'ach_authorization', 'convenience_fee_rule',
      'payroll_tax_estimate', 'vendor_tax_status', 'compliance_review', 'manual_override'
    )),
  actor_type text not null default 'system'
    check (actor_type in ('system', 'admin', 'user')),
  actor_id uuid,
  related_entity_type text,
  related_entity_id uuid,
  audit_summary text not null,
  immutable_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.blitzpay_compliance_audit_block_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'blitzpay_compliance_audit_immutable';
end;
$$;

drop trigger if exists trg_blitzpay_compliance_audit_block_update on public.blitzpay_compliance_audit_log;
create trigger trg_blitzpay_compliance_audit_block_update
before update on public.blitzpay_compliance_audit_log
for each row execute function public.blitzpay_compliance_audit_block_mutation();

drop trigger if exists trg_blitzpay_compliance_audit_block_delete on public.blitzpay_compliance_audit_log;
create trigger trg_blitzpay_compliance_audit_block_delete
before delete on public.blitzpay_compliance_audit_log
for each row execute function public.blitzpay_compliance_audit_block_mutation();

create index if not exists idx_blitzpay_compliance_audit_org_created
  on public.blitzpay_compliance_audit_log (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- ACH authorizations (retention tracking; hashed references only)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_ach_authorizations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  authorization_status text not null default 'active'
    check (authorization_status in ('active', 'revoked', 'expired', 'archived')),
  authorization_method text not null default 'digital'
    check (authorization_method in ('digital', 'signed_document', 'verbal', 'imported')),
  authorization_reference_hash text,
  authorized_at timestamptz not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_ach_auth_org_status
  on public.blitzpay_ach_authorizations (organization_id, authorization_status);

-- ---------------------------------------------------------------------------
-- Vendor tax profiles (1099 readiness)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_vendor_tax_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vendor_id uuid not null references public.blitzpay_vendors (id) on delete cascade,
  tax_profile_status text not null default 'pending'
    check (tax_profile_status in ('pending', 'complete', 'expired', 'flagged')),
  tax_classification text not null default 'llc'
    check (tax_classification in (
      'individual', 'llc', 'corporation', 's_corp', 'partnership', 'nonprofit', 'government'
    )),
  requires_1099 boolean not null default false,
  tin_reference_hash text,
  w9_received_at timestamptz,
  last_reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blitzpay_vendor_tax_profiles_org_vendor unique (organization_id, vendor_id)
);

create index if not exists idx_blitzpay_vendor_tax_profiles_org_status
  on public.blitzpay_vendor_tax_profiles (organization_id, tax_profile_status);

-- ---------------------------------------------------------------------------
-- Tax liability snapshots (aggregates for reporting; optional scheduled fills)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_tax_liability_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  snapshot_date date not null,
  sales_tax_payable_cents bigint not null default 0 check (sales_tax_payable_cents >= 0),
  payroll_tax_payable_cents bigint not null default 0 check (payroll_tax_payable_cents >= 0),
  contractor_tax_estimate_cents bigint not null default 0 check (contractor_tax_estimate_cents >= 0),
  convenience_fee_collected_cents bigint not null default 0 check (convenience_fee_collected_cents >= 0),
  total_tax_liability_cents bigint not null default 0 check (total_tax_liability_cents >= 0),
  filing_readiness_score integer check (filing_readiness_score is null or (filing_readiness_score >= 0 and filing_readiness_score <= 100)),
  compliance_risk_score integer check (compliance_risk_score is null or (compliance_risk_score >= 0 and compliance_risk_score <= 100)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint blitzpay_tax_liability_snapshots_org_date unique (organization_id, snapshot_date)
);

create index if not exists idx_blitzpay_tax_liability_snapshots_org_date
  on public.blitzpay_tax_liability_snapshots (organization_id, snapshot_date desc);

-- ---------------------------------------------------------------------------
-- Archived tax rules immutable
-- ---------------------------------------------------------------------------
create or replace function public.blitzpay_tax_rules_block_archived_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.compliance_status = 'archived' then
    raise exception 'blitzpay_tax_rules_archived_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_blitzpay_tax_rules_archived_guard on public.blitzpay_tax_rules;
create trigger trg_blitzpay_tax_rules_archived_guard
before update on public.blitzpay_tax_rules
for each row execute function public.blitzpay_tax_rules_block_archived_mutation();

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
drop trigger if exists trg_blitzpay_tax_jurisdictions_updated on public.blitzpay_tax_jurisdictions;
create trigger trg_blitzpay_tax_jurisdictions_updated
before update on public.blitzpay_tax_jurisdictions
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_tax_rules_updated on public.blitzpay_tax_rules;
create trigger trg_blitzpay_tax_rules_updated
before update on public.blitzpay_tax_rules
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_ach_authorizations_updated on public.blitzpay_ach_authorizations;
create trigger trg_blitzpay_ach_authorizations_updated
before update on public.blitzpay_ach_authorizations
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_vendor_tax_profiles_updated on public.blitzpay_vendor_tax_profiles;
create trigger trg_blitzpay_vendor_tax_profiles_updated
before update on public.blitzpay_vendor_tax_profiles
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
revoke all on table public.blitzpay_tax_jurisdictions from public, anon;
revoke all on table public.blitzpay_tax_rules from public, anon;
revoke all on table public.blitzpay_tax_calculations from public, anon;
revoke all on table public.blitzpay_compliance_audit_log from public, anon;
revoke all on table public.blitzpay_ach_authorizations from public, anon;
revoke all on table public.blitzpay_vendor_tax_profiles from public, anon;
revoke all on table public.blitzpay_tax_liability_snapshots from public, anon;

grant select on table public.blitzpay_tax_jurisdictions to authenticated;
grant select on table public.blitzpay_tax_rules to authenticated;
grant select on table public.blitzpay_tax_calculations to authenticated;
grant select on table public.blitzpay_compliance_audit_log to authenticated;
grant select on table public.blitzpay_ach_authorizations to authenticated;
grant select on table public.blitzpay_vendor_tax_profiles to authenticated;
grant select on table public.blitzpay_tax_liability_snapshots to authenticated;

alter table public.blitzpay_tax_jurisdictions enable row level security;
alter table public.blitzpay_tax_jurisdictions force row level security;
alter table public.blitzpay_tax_rules enable row level security;
alter table public.blitzpay_tax_rules force row level security;
alter table public.blitzpay_tax_calculations enable row level security;
alter table public.blitzpay_tax_calculations force row level security;
alter table public.blitzpay_compliance_audit_log enable row level security;
alter table public.blitzpay_compliance_audit_log force row level security;
alter table public.blitzpay_ach_authorizations enable row level security;
alter table public.blitzpay_ach_authorizations force row level security;
alter table public.blitzpay_vendor_tax_profiles enable row level security;
alter table public.blitzpay_vendor_tax_profiles force row level security;
alter table public.blitzpay_tax_liability_snapshots enable row level security;
alter table public.blitzpay_tax_liability_snapshots force row level security;

drop policy if exists "blitzpay_tax_jurisdictions_select_finance_roles" on public.blitzpay_tax_jurisdictions;
create policy "blitzpay_tax_jurisdictions_select_finance_roles"
on public.blitzpay_tax_jurisdictions
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_tax_rules_select_finance_roles" on public.blitzpay_tax_rules;
create policy "blitzpay_tax_rules_select_finance_roles"
on public.blitzpay_tax_rules
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_tax_calculations_select_finance_roles" on public.blitzpay_tax_calculations;
create policy "blitzpay_tax_calculations_select_finance_roles"
on public.blitzpay_tax_calculations
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_compliance_audit_select_finance_roles" on public.blitzpay_compliance_audit_log;
create policy "blitzpay_compliance_audit_select_finance_roles"
on public.blitzpay_compliance_audit_log
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_ach_auth_select_finance_roles" on public.blitzpay_ach_authorizations;
create policy "blitzpay_ach_auth_select_finance_roles"
on public.blitzpay_ach_authorizations
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_vendor_tax_profiles_select_finance_roles" on public.blitzpay_vendor_tax_profiles;
create policy "blitzpay_vendor_tax_profiles_select_finance_roles"
on public.blitzpay_vendor_tax_profiles
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_tax_liability_snapshots_select_finance_roles" on public.blitzpay_tax_liability_snapshots;
create policy "blitzpay_tax_liability_snapshots_select_finance_roles"
on public.blitzpay_tax_liability_snapshots
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));
