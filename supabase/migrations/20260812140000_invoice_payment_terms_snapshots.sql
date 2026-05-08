-- Invoices + Customers — Phase 5 payment terms snapshots
--
-- Existing terms fields remain the source of truth for older code:
--   customers.default_invoice_terms_code
--   org_invoices.terms_code / terms_custom_days / due_date
--
-- These additive columns provide Phase 5-compatible names and labels for
-- imports, UI display, and stable invoice snapshots.

alter table public.customers
  add column if not exists default_payment_terms_key text,
  add column if not exists default_payment_terms_days integer,
  add column if not exists default_payment_terms_label text;

alter table public.org_invoices
  add column if not exists payment_terms_key text,
  add column if not exists payment_terms_days integer,
  add column if not exists payment_terms_label text,
  add column if not exists due_date_overridden boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_default_payment_terms_key_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_default_payment_terms_key_check
      check (
        default_payment_terms_key is null or default_payment_terms_key in (
          'due_on_receipt',
          'net_7',
          'net_14',
          'net_15',
          'net_30',
          'net_45',
          'net_60',
          'custom'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_default_payment_terms_days_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_default_payment_terms_days_check
      check (default_payment_terms_days is null or (default_payment_terms_days >= 0 and default_payment_terms_days <= 365));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'org_invoices_payment_terms_key_check'
      and conrelid = 'public.org_invoices'::regclass
  ) then
    alter table public.org_invoices
      add constraint org_invoices_payment_terms_key_check
      check (
        payment_terms_key is null or payment_terms_key in (
          'due_on_receipt',
          'net_7',
          'net_14',
          'net_15',
          'net_30',
          'net_45',
          'net_60',
          'custom'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'org_invoices_payment_terms_days_check'
      and conrelid = 'public.org_invoices'::regclass
  ) then
    alter table public.org_invoices
      add constraint org_invoices_payment_terms_days_check
      check (payment_terms_days is null or (payment_terms_days >= 0 and payment_terms_days <= 365));
  end if;
end;
$$;

update public.customers
set
  default_payment_terms_key = coalesce(default_payment_terms_key, default_invoice_terms_code),
  default_payment_terms_label = coalesce(default_payment_terms_label, replace(initcap(replace(default_invoice_terms_code, '_', ' ')), 'Net ', 'Net '))
where default_invoice_terms_code is not null
  and default_payment_terms_key is null;

update public.org_invoices
set
  payment_terms_key = coalesce(payment_terms_key, terms_code),
  payment_terms_days = coalesce(
    payment_terms_days,
    case
      when terms_code = 'due_on_receipt' then 0
      when terms_code = 'net_7' then 7
      when terms_code = 'net_14' then 14
      when terms_code = 'net_15' then 15
      when terms_code = 'net_30' then 30
      when terms_code = 'net_45' then 45
      when terms_code = 'net_60' then 60
      when terms_code = 'custom' then terms_custom_days
      else null
    end
  )
where terms_code is not null
  and payment_terms_key is null;

comment on column public.customers.default_payment_terms_key is
  'Phase 5 customer default terms key. Mirrors default_invoice_terms_code for compatibility.';
comment on column public.customers.default_payment_terms_days is
  'Resolved days for custom/default payment terms.';
comment on column public.customers.default_payment_terms_label is
  'Human terms label captured from UI/import.';
comment on column public.org_invoices.payment_terms_key is
  'Invoice-level terms snapshot key.';
comment on column public.org_invoices.payment_terms_days is
  'Invoice-level terms snapshot days used for due-date calculation.';
comment on column public.org_invoices.payment_terms_label is
  'Invoice-level human terms label snapshot.';
comment on column public.org_invoices.due_date_overridden is
  'True when a user manually edited due_date instead of using terms calculation.';
