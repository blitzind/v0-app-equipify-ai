-- Invoices + Customers + Locations — Phase 6 US location-based tax framework
--
-- Provider-neutral tax snapshots and exemption fields for US state, county,
-- city/local, district, and special-jurisdiction taxes. This migration does not
-- calculate rates, call a tax provider, or assert tax compliance.

alter table public.org_invoices
  add column if not exists tax_calculation_mode text,
  add column if not exists tax_basis text,
  add column if not exists tax_jurisdiction_label text,
  add column if not exists tax_rate_percent numeric(8,4),
  add column if not exists tax_amount_cents bigint,
  add column if not exists taxable_subtotal_cents bigint,
  add column if not exists non_taxable_subtotal_cents bigint,
  add column if not exists tax_exemption_applied boolean,
  add column if not exists tax_exemption_reason text,
  add column if not exists tax_provider text,
  add column if not exists tax_provider_reference text,
  add column if not exists tax_snapshot_json jsonb;

alter table public.customers
  add column if not exists tax_exempt boolean,
  add column if not exists tax_exemption_id text,
  add column if not exists tax_exemption_notes text,
  add column if not exists default_tax_basis text,
  add column if not exists default_tax_category text;

alter table public.customer_locations
  add column if not exists tax_exempt boolean,
  add column if not exists tax_exemption_id text,
  add column if not exists tax_exemption_notes text,
  add column if not exists default_tax_category text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'org_invoices_tax_calculation_mode_check'
      and conrelid = 'public.org_invoices'::regclass
  ) then
    alter table public.org_invoices
      add constraint org_invoices_tax_calculation_mode_check
      check (
        tax_calculation_mode is null or
        tax_calculation_mode in ('manual', 'exempt', 'provider_pending', 'provider_calculated')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'org_invoices_tax_basis_check'
      and conrelid = 'public.org_invoices'::regclass
  ) then
    alter table public.org_invoices
      add constraint org_invoices_tax_basis_check
      check (
        tax_basis is null or
        tax_basis in ('service_location', 'billing_address', 'manual')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_default_tax_basis_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_default_tax_basis_check
      check (
        default_tax_basis is null or
        default_tax_basis in ('service_location', 'billing_address', 'manual')
      );
  end if;
end;
$$;

comment on column public.org_invoices.tax_calculation_mode is
  'US jurisdiction-based tax mode: manual, exempt, provider_pending, provider_calculated. Manual is an estimate only.';
comment on column public.org_invoices.tax_basis is
  'Address/source used as the tax basis nationwide: service_location, billing_address, or manual.';
comment on column public.org_invoices.tax_jurisdiction_label is
  'Human-readable US tax jurisdiction label, such as state/county/city/district context. Not a calculated rate.';
comment on column public.org_invoices.tax_snapshot_json is
  'Provider-neutral US jurisdiction tax snapshot for future Stripe Tax, Avalara, or TaxJar integration.';
comment on column public.customers.tax_exempt is
  'Customer-level tax exemption default. Does not prove compliance.';
comment on column public.customer_locations.tax_exempt is
  'Optional location-level tax exemption override.';
