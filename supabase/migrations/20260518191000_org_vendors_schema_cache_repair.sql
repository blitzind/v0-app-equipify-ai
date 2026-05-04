-- Repair migration for vendor schema cache drift.
-- Ensures org_vendors exists with RLS and org-scoped policies.

create table if not exists public.org_vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  contact_name text,
  billing_address text,
  shipping_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_archived boolean not null default false,
  archived_at timestamptz,
  constraint org_vendors_archive_consistency check (
    (is_archived = true and archived_at is not null) or
    (is_archived = false and archived_at is null)
  )
);

create index if not exists idx_org_vendors_org_name
  on public.org_vendors (organization_id, name);

create index if not exists idx_org_vendors_org_archived
  on public.org_vendors (organization_id, is_archived);

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_org_vendors_set_updated_at on public.org_vendors;
    create trigger trg_org_vendors_set_updated_at
    before update on public.org_vendors
    for each row execute function public.set_updated_at();
  end if;
end
$$;

revoke all on table public.org_vendors from public, anon;
grant select, insert, update, delete on table public.org_vendors to authenticated;

alter table public.org_vendors enable row level security;

drop policy if exists "org_vendors_select_member" on public.org_vendors;
create policy "org_vendors_select_member"
on public.org_vendors
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "org_vendors_write_roles" on public.org_vendors;
create policy "org_vendors_write_roles"
on public.org_vendors
for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));
