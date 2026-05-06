-- Idempotent ensure for production DBs that may have skipped earlier workspace migrations.
alter table public.organizations add column if not exists logo_url text;
alter table public.organizations add column if not exists document_logo_url text;
