-- Wide / horizontal logo for PDFs, certificates, invoices, and print layouts (Growth+ branding).

alter table public.organizations
  add column if not exists document_logo_url text;

comment on column public.organizations.document_logo_url is
  'Public URL for landscape document logo (certificates, PDFs, invoices). Falls back to logo_url when unset.';
