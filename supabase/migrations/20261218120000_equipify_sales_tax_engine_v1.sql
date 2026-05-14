-- Equipify native sales tax engine v1 — jurisdiction tables, org settings, audit logs, quote parity.
-- Deterministic calculations only; no filing/remittance. Reference rates are illustrative examples
-- for California ZIPs (operators must verify against official schedules before production use).

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regprocedure('public.has_org_role(uuid, text[])') is null then
    raise exception 'Missing dependency: public.has_org_role';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'Missing dependency: public.set_updated_at';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Core catalog: jurisdictions (system rows use organization_id IS NULL)
-- ---------------------------------------------------------------------------
create table if not exists public.tax_jurisdictions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  country_code text not null default 'US',
  region_code text not null,
  county_name text,
  city_name text,
  postal_code text,
  jurisdiction_type text not null
    check (jurisdiction_type in ('country', 'state', 'county', 'city', 'district', 'special')),
  code text not null,
  display_name text not null,
  active boolean not null default true,
  source text not null default 'equipify_catalog',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- System catalog: one row per stable code. Org overlays: unique per (org, code).
drop index if exists tax_jurisdictions_system_code_unique_idx;
create unique index tax_jurisdictions_system_code_unique_idx
  on public.tax_jurisdictions (code)
  where organization_id is null;

drop index if exists tax_jurisdictions_org_code_unique_idx;
create unique index tax_jurisdictions_org_code_unique_idx
  on public.tax_jurisdictions (organization_id, code)
  where organization_id is not null;

comment on table public.tax_jurisdictions is
  'Geographic tax jurisdictions. organization_id NULL = Equipify-maintained reference catalog; otherwise org-specific overlay.';

create index if not exists idx_tax_jurisdictions_region_active
  on public.tax_jurisdictions (country_code, region_code, active)
  where active = true;

-- ---------------------------------------------------------------------------
-- Effective-dated rates per jurisdiction
-- ---------------------------------------------------------------------------
create table if not exists public.tax_rates (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_id uuid not null references public.tax_jurisdictions (id) on delete cascade,
  rate_percent numeric(12, 8) not null check (rate_percent >= 0 and rate_percent <= 100),
  applies_to text not null default 'all'
    check (applies_to in ('all', 'labor', 'parts', 'services')),
  effective_start date not null,
  effective_end date,
  active boolean not null default true,
  source text not null default 'equipify_catalog',
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tax_rates_effective_range check (
    effective_end is null or effective_end >= effective_start
  )
);

comment on table public.tax_rates is
  'Stackable percentage rates; multiple active rows per ZIP may apply (state + district).';

create index if not exists idx_tax_rates_jurisdiction_effective
  on public.tax_rates (jurisdiction_id, effective_start desc, active);

-- ---------------------------------------------------------------------------
-- Organization-level sales tax configuration
-- ---------------------------------------------------------------------------
create table if not exists public.organization_tax_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  auto_tax_enabled boolean not null default false,
  fallback_tax_rate_percent numeric(10, 6) not null default 0
    check (fallback_tax_rate_percent >= 0 and fallback_tax_rate_percent <= 100),
  taxable_labor_default boolean not null default true,
  taxable_parts_default boolean not null default true,
  sourcing_mode text not null default 'destination'
    check (sourcing_mode in ('origin', 'destination')),
  manual_override_allowed boolean not null default true,
  primary_provider text not null default 'equipify_native',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organization_tax_settings is
  'Per-workspace sales tax behavior; backward compatible default is auto_tax_enabled=false (flat/manual UI).';

-- ---------------------------------------------------------------------------
-- Optional per-customer overrides (fixed combined rate, etc.)
-- ---------------------------------------------------------------------------
create table if not exists public.customer_tax_overrides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  fixed_combined_rate_percent numeric(10, 6)
    check (fixed_combined_rate_percent is null or (fixed_combined_rate_percent >= 0 and fixed_combined_rate_percent <= 100)),
  force_tax_exempt boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_tax_overrides_org_customer unique (organization_id, customer_id)
);

comment on table public.customer_tax_overrides is
  'Optional customer-level sales tax overrides; does not prove exemption compliance.';

create index if not exists idx_customer_tax_overrides_org
  on public.customer_tax_overrides (organization_id);

-- ---------------------------------------------------------------------------
-- Append-only calculation audit trail
-- ---------------------------------------------------------------------------
create table if not exists public.tax_calculation_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  idempotency_key text,
  source_type text not null,
  source_id uuid,
  status text not null
    check (status in ('success', 'error', 'skipped', 'fallback')),
  taxable_base_cents bigint not null default 0 check (taxable_base_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  combined_rate_percent numeric(14, 8),
  calculation_json jsonb not null default '{}'::jsonb,
  error_code text,
  actor_user_id uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists tax_calculation_logs_idempotency_unique
  on public.tax_calculation_logs (organization_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_tax_calculation_logs_org_created
  on public.tax_calculation_logs (organization_id, created_at desc);

comment on table public.tax_calculation_logs is
  'Deterministic sales tax calculation audit trail (preview + persisted flows).';

-- ---------------------------------------------------------------------------
-- org_quotes — tax snapshot parity with org_invoices
-- ---------------------------------------------------------------------------
alter table public.org_quotes
  add column if not exists tax_calculation_mode text,
  add column if not exists tax_basis text,
  add column if not exists tax_jurisdiction_label text,
  add column if not exists tax_rate_percent numeric(8, 4),
  add column if not exists tax_amount_cents bigint,
  add column if not exists taxable_subtotal_cents bigint,
  add column if not exists non_taxable_subtotal_cents bigint,
  add column if not exists tax_exemption_applied boolean,
  add column if not exists tax_exemption_reason text,
  add column if not exists tax_provider text,
  add column if not exists tax_provider_reference text,
  add column if not exists tax_snapshot_json jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'org_quotes_tax_calculation_mode_check'
      and conrelid = 'public.org_quotes'::regclass
  ) then
    alter table public.org_quotes
      add constraint org_quotes_tax_calculation_mode_check
      check (
        tax_calculation_mode is null or
        tax_calculation_mode in ('manual', 'exempt', 'provider_pending', 'provider_calculated', 'automated')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'org_quotes_tax_basis_check'
      and conrelid = 'public.org_quotes'::regclass
  ) then
    alter table public.org_quotes
      add constraint org_quotes_tax_basis_check
      check (
        tax_basis is null or
        tax_basis in ('service_location', 'billing_address', 'manual')
      );
  end if;
end;
$$;

-- Extend org_invoices tax_calculation_mode to include automated (native engine)
alter table public.org_invoices drop constraint if exists org_invoices_tax_calculation_mode_check;
alter table public.org_invoices
  add constraint org_invoices_tax_calculation_mode_check
  check (
    tax_calculation_mode is null or
    tax_calculation_mode in ('manual', 'exempt', 'provider_pending', 'provider_calculated', 'automated')
  );

-- ---------------------------------------------------------------------------
-- Seed California reference stack (illustrative — verify before production)
-- ---------------------------------------------------------------------------
do $$
declare
  j_state uuid;
  j_90210 uuid;
  j_94102 uuid;
  j_95814 uuid;
  eff date := date '2026-01-01';
begin
  if exists (select 1 from public.tax_jurisdictions where organization_id is null and code = 'US-CA-STATE-SALES') then
    null;
  else
  insert into public.tax_jurisdictions (
    organization_id, country_code, region_code, county_name, city_name, postal_code,
    jurisdiction_type, code, display_name, active, source, metadata
  ) values (
    null, 'US', 'CA', null, null, null, 'state', 'US-CA-STATE-SALES',
    'California — state component (reference)', true, 'equipify_seed_ca_v1',
    jsonb_build_object(
      'disclaimer', 'Illustrative split for engineering tests; verify against CDTFA / local schedules.',
      'stacking', 'additive'
    )
  ) returning id into j_state;

  insert into public.tax_rates (
    jurisdiction_id, rate_percent, applies_to, effective_start, active, source, metadata
  ) values (
    j_state, 6.00000000, 'all', eff, true, 'equipify_seed_ca_v1',
    jsonb_build_object('reference_tag', 'ca_state_component_example')
  );

  insert into public.tax_jurisdictions (
    organization_id, country_code, region_code, county_name, city_name, postal_code,
    jurisdiction_type, code, display_name, active, source, metadata
  ) values (
    null, 'US', 'CA', null, null, '90210', 'district', 'US-CA-ZIP-90210-LOCAL',
    'California — local / district example (90210)', true, 'equipify_seed_ca_v1',
    jsonb_build_object('example_zip', '90210')
  ) returning id into j_90210;

  insert into public.tax_rates (
    jurisdiction_id, rate_percent, applies_to, effective_start, active, source, metadata
  ) values (
    j_90210, 3.37500000, 'all', eff, true, 'equipify_seed_ca_v1',
    jsonb_build_object('note', 'Illustrative local+district stack on top of state seed row.')
  );

  insert into public.tax_jurisdictions (
    organization_id, country_code, region_code, county_name, city_name, postal_code,
    jurisdiction_type, code, display_name, active, source, metadata
  ) values (
    null, 'US', 'CA', null, null, '94102', 'district', 'US-CA-ZIP-94102-LOCAL',
    'California — local / district example (94102)', true, 'equipify_seed_ca_v1',
    jsonb_build_object('example_zip', '94102')
  ) returning id into j_94102;

  insert into public.tax_rates (
    jurisdiction_id, rate_percent, applies_to, effective_start, active, source, metadata
  ) values (
    j_94102, 2.62500000, 'all', eff, true, 'equipify_seed_ca_v1',
    jsonb_build_object('note', 'Illustrative combined local rate example.')
  );

  insert into public.tax_jurisdictions (
    organization_id, country_code, region_code, county_name, city_name, postal_code,
    jurisdiction_type, code, display_name, active, source, metadata
  ) values (
    null, 'US', 'CA', null, null, '95814', 'district', 'US-CA-ZIP-95814-LOCAL',
    'California — local / district example (95814)', true, 'equipify_seed_ca_v1',
    jsonb_build_object('example_zip', '95814')
  ) returning id into j_95814;

  insert into public.tax_rates (
    jurisdiction_id, rate_percent, applies_to, effective_start, active, source, metadata
  ) values (
    j_95814, 2.50000000, 'all', eff, true, 'equipify_seed_ca_v1',
    jsonb_build_object('note', 'Illustrative combined local rate example.')
  );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists trg_tax_jurisdictions_updated on public.tax_jurisdictions;
create trigger trg_tax_jurisdictions_updated
before update on public.tax_jurisdictions
for each row execute function public.set_updated_at();

drop trigger if exists trg_tax_rates_updated on public.tax_rates;
create trigger trg_tax_rates_updated
before update on public.tax_rates
for each row execute function public.set_updated_at();

drop trigger if exists trg_organization_tax_settings_updated on public.organization_tax_settings;
create trigger trg_organization_tax_settings_updated
before update on public.organization_tax_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_customer_tax_overrides_updated on public.customer_tax_overrides;
create trigger trg_customer_tax_overrides_updated
before update on public.customer_tax_overrides
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
revoke all on table public.tax_jurisdictions from public, anon;
revoke all on table public.tax_rates from public, anon;
revoke all on table public.organization_tax_settings from public, anon;
revoke all on table public.customer_tax_overrides from public, anon;
revoke all on table public.tax_calculation_logs from public, anon;

grant select on table public.tax_jurisdictions to authenticated;
grant select on table public.tax_rates to authenticated;
grant select on table public.organization_tax_settings to authenticated;
grant select, insert, update, delete on table public.customer_tax_overrides to authenticated;
grant select, insert on table public.tax_calculation_logs to authenticated;
grant select, insert, update, delete on table public.organization_tax_settings to authenticated;

alter table public.tax_jurisdictions enable row level security;
alter table public.tax_jurisdictions force row level security;
alter table public.tax_rates enable row level security;
alter table public.tax_rates force row level security;
alter table public.organization_tax_settings enable row level security;
alter table public.organization_tax_settings force row level security;
alter table public.customer_tax_overrides enable row level security;
alter table public.customer_tax_overrides force row level security;
alter table public.tax_calculation_logs enable row level security;
alter table public.tax_calculation_logs force row level security;

-- System catalog readable by any signed-in user (non-secret reference data).
drop policy if exists "tax_jurisdictions_select_system_or_org" on public.tax_jurisdictions;
create policy "tax_jurisdictions_select_system_or_org"
on public.tax_jurisdictions
for select
to authenticated
using (
  organization_id is null
  or public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);

drop policy if exists "tax_rates_select_via_jurisdiction" on public.tax_rates;
create policy "tax_rates_select_via_jurisdiction"
on public.tax_rates
for select
to authenticated
using (
  exists (
    select 1
    from public.tax_jurisdictions j
    where j.id = tax_rates.jurisdiction_id
      and (
        j.organization_id is null
        or public.has_org_role(j.organization_id, array['owner', 'admin', 'manager'])
      )
  )
);

drop policy if exists "organization_tax_settings_select_roles" on public.organization_tax_settings;
create policy "organization_tax_settings_select_roles"
on public.organization_tax_settings
for select
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "organization_tax_settings_insert_roles" on public.organization_tax_settings;
create policy "organization_tax_settings_insert_roles"
on public.organization_tax_settings
for insert
to authenticated
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "organization_tax_settings_update_roles" on public.organization_tax_settings;
create policy "organization_tax_settings_update_roles"
on public.organization_tax_settings
for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "customer_tax_overrides_select_roles" on public.customer_tax_overrides;
create policy "customer_tax_overrides_select_roles"
on public.customer_tax_overrides
for select
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "customer_tax_overrides_insert_roles" on public.customer_tax_overrides;
create policy "customer_tax_overrides_insert_roles"
on public.customer_tax_overrides
for insert
to authenticated
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "customer_tax_overrides_update_roles" on public.customer_tax_overrides;
create policy "customer_tax_overrides_update_roles"
on public.customer_tax_overrides
for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "customer_tax_overrides_delete_roles" on public.customer_tax_overrides;
create policy "customer_tax_overrides_delete_roles"
on public.customer_tax_overrides
for delete
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "tax_calculation_logs_select_roles" on public.tax_calculation_logs;
create policy "tax_calculation_logs_select_roles"
on public.tax_calculation_logs
for select
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "tax_calculation_logs_insert_roles" on public.tax_calculation_logs;
create policy "tax_calculation_logs_insert_roles"
on public.tax_calculation_logs
for insert
to authenticated
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));
