-- Phase 1: Portal certificate release rules + manual release timestamp.
-- immediate_release | release_on_payment | manual_release
-- Nullable customer override inherits organization default in application layer.

-- ─── organizations ───────────────────────────────────────────────────────────
alter table public.organizations
  add column if not exists portal_certificate_release_mode text;

update public.organizations
set portal_certificate_release_mode = coalesce(portal_certificate_release_mode, 'immediate_release');

alter table public.organizations
  alter column portal_certificate_release_mode set default 'immediate_release';

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'organizations' and c.conname = 'organizations_portal_certificate_release_mode_check'
  ) then
    alter table public.organizations
      add constraint organizations_portal_certificate_release_mode_check
      check (
        portal_certificate_release_mode is null or portal_certificate_release_mode in (
          'immediate_release',
          'release_on_payment',
          'manual_release'
        )
      );
  end if;
end $$;

comment on column public.organizations.portal_certificate_release_mode is
  'Portal certificate download policy: immediate_release | release_on_payment | manual_release. Defaults to immediate_release.';

-- ─── customers (optional override; null = use organization default) ─────────
alter table public.customers
  add column if not exists portal_certificate_release_mode text;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'customers' and c.conname = 'customers_portal_certificate_release_mode_check'
  ) then
    alter table public.customers
      add constraint customers_portal_certificate_release_mode_check
      check (
        portal_certificate_release_mode is null or portal_certificate_release_mode in (
          'immediate_release',
          'release_on_payment',
          'manual_release'
        )
      );
  end if;
end $$;

comment on column public.customers.portal_certificate_release_mode is
  'Optional override for portal certificate release; null inherits organizations.portal_certificate_release_mode.';

-- ─── invoices (future-safe per-invoice override) ─────────────────────────────
alter table public.org_invoices
  add column if not exists portal_certificate_release_override text;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'org_invoices' and c.conname = 'org_invoices_portal_certificate_release_override_check'
  ) then
    alter table public.org_invoices
      add constraint org_invoices_portal_certificate_release_override_check
      check (
        portal_certificate_release_override is null or portal_certificate_release_override in (
          'immediate_release',
          'release_on_payment',
          'manual_release'
        )
      );
  end if;
end $$;

comment on column public.org_invoices.portal_certificate_release_override is
  'Optional portal certificate policy override for jobs billed on this invoice (future use).';

-- ─── calibration_records (staff manual release for manual_release mode) ──────
alter table public.calibration_records
  add column if not exists portal_released_at timestamptz;

comment on column public.calibration_records.portal_released_at is
  'When set, portal may download this certificate when organization policy is manual_release.';

create index if not exists idx_calibration_records_org_portal_released
  on public.calibration_records (organization_id, portal_released_at)
  where portal_released_at is not null;
