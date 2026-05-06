-- Workspace / company profile fields for Settings → Workspace (RLS: existing org_update_admin_owner).

alter table public.organizations
  add column if not exists company_email text,
  add column if not exists company_phone text,
  add column if not exists company_website text,
  add column if not exists company_address text,
  add column if not exists timezone text default 'America/New_York',
  add column if not exists date_format text default 'MM/DD/YYYY',
  add column if not exists currency text default 'USD',
  add column if not exists logo_url text,
  add column if not exists primary_color text default '#2563eb',
  add column if not exists secondary_brand_color text,
  add column if not exists white_label_settings jsonb not null default '{}'::jsonb;

comment on column public.organizations.company_email is 'Public-facing company contact email for this workspace.';
comment on column public.organizations.logo_url is 'Public URL for workspace logo (e.g. Supabase Storage).';
comment on column public.organizations.primary_color is 'Hex accent for white-label UI (Growth+).';
comment on column public.organizations.white_label_settings is 'Future: portal toggles, hide-powered-by, etc.';

alter table public.organizations
  drop constraint if exists organizations_date_format_check;

alter table public.organizations
  add constraint organizations_date_format_check
  check (date_format in ('MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'));

alter table public.organizations
  drop constraint if exists organizations_currency_check;

alter table public.organizations
  add constraint organizations_currency_check
  check (currency in ('USD', 'EUR', 'GBP', 'CAD', 'AUD'));
