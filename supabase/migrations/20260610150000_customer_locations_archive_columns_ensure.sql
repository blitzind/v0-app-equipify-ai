-- Ensure customer_locations uses the same timestamp archive model as the app (archived_at / archived_by / archive_reason).
-- Idempotent: fixes environments that never applied 20260609140000_archive_timestamp_only.sql or have a partial state.

alter table public.customer_locations
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users (id) on delete set null,
  add column if not exists archive_reason text;

-- Backfill from legacy is_archived when that column still exists, then drop it.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customer_locations'
      and column_name = 'is_archived'
  ) then
    update public.customer_locations
      set archived_at = coalesce(archived_at, now())
      where is_archived = true and archived_at is null;
    update public.customer_locations
      set archived_at = null
      where is_archived = false;
    alter table public.customer_locations drop column if exists is_archived;
  end if;
end $$;

-- Replace legacy boolean archive index
drop index if exists public.idx_customer_locations_org_archived;

create index if not exists idx_customer_locations_org_archived_at
  on public.customer_locations (organization_id, archived_at);

-- One default location per customer among non-archived rows only
drop index if exists public.idx_customer_locations_default_per_customer;

create unique index if not exists idx_customer_locations_default_per_customer
  on public.customer_locations (customer_id)
  where is_default = true and archived_at is null;
