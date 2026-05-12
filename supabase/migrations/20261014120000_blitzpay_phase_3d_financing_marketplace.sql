-- BlitzPay Phase 3D — Native financing marketplace foundations (orchestration only; no lending/custody).
-- NOTE: Phase 2O already owns `blitzpay_financing_providers` (platform catalog by `code`) and session-scoped
-- `blitzpay_financing_offers`. Phase 3D uses distinct tables:
--   `blitzpay_marketplace_financing_providers` — org / platform marketplace provider rows (UUID id)
--   `blitzpay_financing_application_offers` — offers tied to marketplace applications (not session offers)

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
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
-- Marketplace financing providers (org-scoped or platform template rows)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_marketplace_financing_providers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  provider_name text not null,
  provider_status text not null default 'active'
    check (provider_status in ('active', 'inactive', 'suspended', 'archived')),
  provider_type text not null default 'customer_financing'
    check (provider_type in (
      'customer_financing', 'equipment_financing', 'contractor_advance', 'membership_financing',
      'revenue_share', 'hybrid'
    )),
  supported_products jsonb not null default '[]'::jsonb,
  minimum_amount_cents bigint check (minimum_amount_cents is null or minimum_amount_cents >= 0),
  maximum_amount_cents bigint check (maximum_amount_cents is null or maximum_amount_cents >= 0),
  supported_regions jsonb not null default '[]'::jsonb,
  provider_reference_hash text,
  contact_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blitzpay_mkt_fin_providers_min_max check (
    minimum_amount_cents is null or maximum_amount_cents is null or maximum_amount_cents >= minimum_amount_cents
  )
);

comment on table public.blitzpay_marketplace_financing_providers is
  'Phase 3D marketplace provider registry; Equipify does not originate credit. Distinct from blitzpay_financing_providers (Phase 2O catalog).';

create index if not exists idx_blitzpay_mkt_fin_providers_org_status
  on public.blitzpay_marketplace_financing_providers (organization_id, provider_status);

-- ---------------------------------------------------------------------------
-- Financing applications
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_financing_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  financing_provider_id uuid references public.blitzpay_marketplace_financing_providers (id) on delete set null,
  application_type text not null default 'customer_service'
    check (application_type in (
      'customer_service', 'equipment_purchase', 'membership', 'contractor_advance', 'revenue_share', 'custom'
    )),
  application_status text not null default 'draft'
    check (application_status in (
      'draft', 'submitted', 'reviewing', 'approved', 'conditionally_approved', 'declined',
      'expired', 'funded', 'canceled'
    )),
  requested_amount_cents bigint not null check (requested_amount_cents >= 0),
  approved_amount_cents bigint check (approved_amount_cents is null or approved_amount_cents >= 0),
  estimated_payment_cents bigint check (estimated_payment_cents is null or estimated_payment_cents >= 0),
  estimated_term_months integer check (estimated_term_months is null or (estimated_term_months >= 0 and estimated_term_months <= 600)),
  qualification_score integer check (qualification_score is null or (qualification_score >= 0 and qualification_score <= 100)),
  linked_invoice_id uuid references public.org_invoices (id) on delete set null,
  linked_work_order_id uuid references public.work_orders (id) on delete set null,
  linked_equipment_id uuid references public.equipment (id) on delete set null,
  linked_membership_id uuid references public.blitzpay_memberships (id) on delete set null,
  expiration_date date,
  provider_application_reference_hash text,
  submitted_at timestamptz,
  decisioned_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_financing_applications is
  'Financing application orchestration; no autonomous underwriting.';

create index if not exists idx_blitzpay_fin_applications_org_status
  on public.blitzpay_financing_applications (organization_id, application_status, created_at desc);

create index if not exists idx_blitzpay_fin_applications_customer
  on public.blitzpay_financing_applications (organization_id, customer_id);

-- ---------------------------------------------------------------------------
-- Application offers (distinct from Phase 2O blitzpay_financing_offers)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_financing_application_offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  financing_application_id uuid not null references public.blitzpay_financing_applications (id) on delete cascade,
  financing_provider_id uuid not null references public.blitzpay_marketplace_financing_providers (id) on delete restrict,
  offer_status text not null default 'active'
    check (offer_status in ('active', 'accepted', 'declined', 'expired', 'withdrawn')),
  offer_amount_cents bigint not null check (offer_amount_cents >= 0),
  estimated_apr_basis_points integer check (
    estimated_apr_basis_points is null or (estimated_apr_basis_points >= 0 and estimated_apr_basis_points <= 1000000)
  ),
  estimated_payment_cents bigint check (estimated_payment_cents is null or estimated_payment_cents >= 0),
  estimated_term_months integer check (estimated_term_months is null or (estimated_term_months >= 0 and estimated_term_months <= 600)),
  deferred_days integer check (deferred_days is null or (deferred_days >= 0 and deferred_days <= 3650)),
  requires_down_payment boolean not null default false,
  down_payment_cents bigint check (down_payment_cents is null or down_payment_cents >= 0),
  provider_offer_reference_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_fin_app_offers_app
  on public.blitzpay_financing_application_offers (financing_application_id, offer_status, created_at desc);

-- ---------------------------------------------------------------------------
-- Contractor advance models (planning / exposure signals)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_contractor_advance_models (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  model_status text not null default 'active'
    check (model_status in ('active', 'inactive', 'archived')),
  advance_type text not null default 'receivables'
    check (advance_type in ('receivables', 'recurring_revenue', 'seasonal', 'payroll_bridge', 'custom')),
  estimated_advance_amount_cents bigint not null check (estimated_advance_amount_cents >= 0),
  estimated_payback_amount_cents bigint not null check (estimated_payback_amount_cents >= 0),
  estimated_term_days integer check (estimated_term_days is null or (estimated_term_days >= 0 and estimated_term_days <= 3650)),
  repayment_method text not null default 'percentage_of_revenue'
    check (repayment_method in ('percentage_of_revenue', 'fixed_payment', 'invoice_split', 'hybrid')),
  risk_score integer check (risk_score is null or (risk_score >= 0 and risk_score <= 100)),
  treasury_impact_score integer check (treasury_impact_score is null or (treasury_impact_score >= 0 and treasury_impact_score <= 100)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_contractor_adv_models_org
  on public.blitzpay_contractor_advance_models (organization_id, model_status);

-- ---------------------------------------------------------------------------
-- Financing audit log (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_financing_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  application_id uuid references public.blitzpay_financing_applications (id) on delete set null,
  audit_type text not null
    check (audit_type in (
      'application_created', 'submitted', 'qualification_scored', 'provider_matched', 'offer_received',
      'offer_accepted', 'offer_declined', 'application_expired', 'manual_override'
    )),
  actor_type text not null default 'system'
    check (actor_type in ('system', 'admin', 'customer')),
  actor_id uuid,
  audit_summary text not null,
  immutable_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.blitzpay_financing_audit_block_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'blitzpay_financing_audit_immutable';
end;
$$;

drop trigger if exists trg_blitzpay_financing_audit_block_update on public.blitzpay_financing_audit_log;
create trigger trg_blitzpay_financing_audit_block_update
before update on public.blitzpay_financing_audit_log
for each row execute function public.blitzpay_financing_audit_block_mutation();

drop trigger if exists trg_blitzpay_financing_audit_block_delete on public.blitzpay_financing_audit_log;
create trigger trg_blitzpay_financing_audit_block_delete
before delete on public.blitzpay_financing_audit_log
for each row execute function public.blitzpay_financing_audit_block_mutation();

create index if not exists idx_blitzpay_fin_audit_org_created
  on public.blitzpay_financing_audit_log (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Provider matches
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_financing_provider_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  financing_application_id uuid not null references public.blitzpay_financing_applications (id) on delete cascade,
  financing_provider_id uuid not null references public.blitzpay_marketplace_financing_providers (id) on delete cascade,
  match_status text not null default 'suggested'
    check (match_status in ('suggested', 'submitted', 'rejected', 'accepted')),
  compatibility_score integer check (compatibility_score is null or (compatibility_score >= 0 and compatibility_score <= 100)),
  match_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint blitzpay_fin_provider_matches_app_provider unique (financing_application_id, financing_provider_id)
);

create index if not exists idx_blitzpay_fin_provider_matches_org
  on public.blitzpay_financing_provider_matches (organization_id, financing_application_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists trg_blitzpay_mkt_fin_providers_updated on public.blitzpay_marketplace_financing_providers;
create trigger trg_blitzpay_mkt_fin_providers_updated
before update on public.blitzpay_marketplace_financing_providers
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_fin_applications_updated on public.blitzpay_financing_applications;
create trigger trg_blitzpay_fin_applications_updated
before update on public.blitzpay_financing_applications
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_fin_app_offers_updated on public.blitzpay_financing_application_offers;
create trigger trg_blitzpay_fin_app_offers_updated
before update on public.blitzpay_financing_application_offers
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_contractor_adv_models_updated on public.blitzpay_contractor_advance_models;
create trigger trg_blitzpay_contractor_adv_models_updated
before update on public.blitzpay_contractor_advance_models
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — finance roles (owner/admin/manager), same pattern as Phase 3C
-- ---------------------------------------------------------------------------
revoke all on table public.blitzpay_marketplace_financing_providers from public, anon;
revoke all on table public.blitzpay_financing_applications from public, anon;
revoke all on table public.blitzpay_financing_application_offers from public, anon;
revoke all on table public.blitzpay_contractor_advance_models from public, anon;
revoke all on table public.blitzpay_financing_audit_log from public, anon;
revoke all on table public.blitzpay_financing_provider_matches from public, anon;

grant select on table public.blitzpay_marketplace_financing_providers to authenticated;
grant select on table public.blitzpay_financing_applications to authenticated;
grant select on table public.blitzpay_financing_application_offers to authenticated;
grant select on table public.blitzpay_contractor_advance_models to authenticated;
grant select on table public.blitzpay_financing_audit_log to authenticated;
grant select on table public.blitzpay_financing_provider_matches to authenticated;

alter table public.blitzpay_marketplace_financing_providers enable row level security;
alter table public.blitzpay_marketplace_financing_providers force row level security;
alter table public.blitzpay_financing_applications enable row level security;
alter table public.blitzpay_financing_applications force row level security;
alter table public.blitzpay_financing_application_offers enable row level security;
alter table public.blitzpay_financing_application_offers force row level security;
alter table public.blitzpay_contractor_advance_models enable row level security;
alter table public.blitzpay_contractor_advance_models force row level security;
alter table public.blitzpay_financing_audit_log enable row level security;
alter table public.blitzpay_financing_audit_log force row level security;
alter table public.blitzpay_financing_provider_matches enable row level security;
alter table public.blitzpay_financing_provider_matches force row level security;

drop policy if exists "blitzpay_mkt_fin_providers_select_finance_roles" on public.blitzpay_marketplace_financing_providers;
create policy "blitzpay_mkt_fin_providers_select_finance_roles"
on public.blitzpay_marketplace_financing_providers
for select
to authenticated
using (
  organization_id is null
  or public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[])
);

drop policy if exists "blitzpay_fin_applications_select_finance_roles" on public.blitzpay_financing_applications;
create policy "blitzpay_fin_applications_select_finance_roles"
on public.blitzpay_financing_applications
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_fin_app_offers_select_finance_roles" on public.blitzpay_financing_application_offers;
create policy "blitzpay_fin_app_offers_select_finance_roles"
on public.blitzpay_financing_application_offers
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_contractor_adv_models_select_finance_roles" on public.blitzpay_contractor_advance_models;
create policy "blitzpay_contractor_adv_models_select_finance_roles"
on public.blitzpay_contractor_advance_models
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_fin_audit_select_finance_roles" on public.blitzpay_financing_audit_log;
create policy "blitzpay_fin_audit_select_finance_roles"
on public.blitzpay_financing_audit_log
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

drop policy if exists "blitzpay_fin_provider_matches_select_finance_roles" on public.blitzpay_financing_provider_matches;
create policy "blitzpay_fin_provider_matches_select_finance_roles"
on public.blitzpay_financing_provider_matches
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[]));

-- Optional platform marketplace templates (organization_id null).
insert into public.blitzpay_marketplace_financing_providers (
  organization_id, provider_name, provider_status, provider_type,
  minimum_amount_cents, maximum_amount_cents, supported_products, supported_regions, metadata
)
select null, 'Sample customer financing (template)', 'active', 'customer_financing',
  50000, 5000000, '["service","equipment"]'::jsonb, '["US"]'::jsonb, '{"phase":"3d_template"}'::jsonb
where not exists (
  select 1 from public.blitzpay_marketplace_financing_providers p
  where p.organization_id is null and p.provider_name = 'Sample customer financing (template)'
);

insert into public.blitzpay_marketplace_financing_providers (
  organization_id, provider_name, provider_status, provider_type,
  minimum_amount_cents, maximum_amount_cents, supported_products, supported_regions, metadata
)
select null, 'Sample equipment financing (template)', 'active', 'equipment_financing',
  100000, 25000000, '["equipment"]'::jsonb, '["US"]'::jsonb, '{"phase":"3d_template"}'::jsonb
where not exists (
  select 1 from public.blitzpay_marketplace_financing_providers p
  where p.organization_id is null and p.provider_name = 'Sample equipment financing (template)'
);
