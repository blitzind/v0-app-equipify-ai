-- Ensure org_quotes/org_invoices always use customer-friendly numbers.
-- Quotes: QT-000001
-- Invoices: INV-000001
-- Idempotent: safe to re-run.

alter table public.org_quotes
  add column if not exists quote_number text;

alter table public.org_invoices
  add column if not exists invoice_number text;

create sequence if not exists public.org_quote_number_seq;
create sequence if not exists public.org_invoice_number_seq;

create or replace function public.format_quote_number(next_number bigint)
returns text
language sql
immutable
as $$
  select 'QT-' || lpad(next_number::text, 6, '0');
$$;

create or replace function public.format_invoice_number(next_number bigint)
returns text
language sql
immutable
as $$
  select 'INV-' || lpad(next_number::text, 6, '0');
$$;

do $$
declare
  max_quote_number bigint;
  max_invoice_number bigint;
begin
  select max((regexp_match(quote_number, '^QT?-([0-9]+)$'))[1]::bigint)
    into max_quote_number
  from public.org_quotes
  where quote_number is not null and btrim(quote_number) <> '';

  perform setval(
    'public.org_quote_number_seq',
    greatest(coalesce(max_quote_number, 0), 1),
    coalesce(max_quote_number, 0) > 0
  );

  select max((regexp_match(invoice_number, '^INV-([0-9]+)$'))[1]::bigint)
    into max_invoice_number
  from public.org_invoices
  where invoice_number is not null and btrim(invoice_number) <> '';

  perform setval(
    'public.org_invoice_number_seq',
    greatest(coalesce(max_invoice_number, 0), 1),
    coalesce(max_invoice_number, 0) > 0
  );
end
$$;

update public.org_quotes
set quote_number = public.format_quote_number(nextval('public.org_quote_number_seq'))
where quote_number is null or btrim(quote_number) = '';

update public.org_invoices
set invoice_number = public.format_invoice_number(nextval('public.org_invoice_number_seq'))
where invoice_number is null or btrim(invoice_number) = '';

create or replace function public.assign_quote_number()
returns trigger
language plpgsql
as $$
begin
  if new.quote_number is null or btrim(new.quote_number) = '' then
    new.quote_number := public.format_quote_number(nextval('public.org_quote_number_seq'));
  end if;
  return new;
end
$$;

create or replace function public.assign_invoice_number()
returns trigger
language plpgsql
as $$
begin
  if new.invoice_number is null or btrim(new.invoice_number) = '' then
    new.invoice_number := public.format_invoice_number(nextval('public.org_invoice_number_seq'));
  end if;
  return new;
end
$$;

drop trigger if exists trg_assign_quote_number on public.org_quotes;
create trigger trg_assign_quote_number
before insert on public.org_quotes
for each row
execute function public.assign_quote_number();

drop trigger if exists trg_assign_invoice_number on public.org_invoices;
create trigger trg_assign_invoice_number
before insert on public.org_invoices
for each row
execute function public.assign_invoice_number();

alter table public.org_quotes
  alter column quote_number set not null;

alter table public.org_invoices
  alter column invoice_number set not null;

do $$
begin
  alter table public.org_quotes
    add constraint org_quotes_org_quote_number unique (organization_id, quote_number);
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.org_invoices
    add constraint org_invoices_org_invoice_number unique (organization_id, invoice_number);
exception
  when duplicate_object then null;
end
$$;
