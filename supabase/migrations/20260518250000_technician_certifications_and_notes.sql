-- Technician certifications and internal notes (org-scoped, Supabase RLS).

create table if not exists public.technician_certifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  technician_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  issuing_organization text,
  certification_number text,
  issued_date date,
  expiration_date date,
  status text not null default 'active'
    check (status in ('active', 'expired', 'archived')),
  notes text,
  attachment_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_technician_certifications_org_tech
  on public.technician_certifications (organization_id, technician_user_id);

create index if not exists idx_technician_certifications_org_expiration
  on public.technician_certifications (organization_id, expiration_date)
  where status = 'active';

comment on table public.technician_certifications is
  'Professional certifications for a technician (auth user) within an organization.';
comment on column public.technician_certifications.attachment_path is
  'Optional storage path for a certificate file; upload wiring can be added later.';

create or replace function public.technician_certifications_validate_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = new.organization_id
      and om.user_id = new.technician_user_id
      and om.status = 'active'
  ) then
    raise exception 'technician_certifications: technician must be an active organization member';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_technician_certifications_validate_member on public.technician_certifications;
create trigger trg_technician_certifications_validate_member
before insert or update of organization_id, technician_user_id on public.technician_certifications
for each row execute function public.technician_certifications_validate_member();

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_technician_certifications_updated_at on public.technician_certifications;
    create trigger trg_technician_certifications_updated_at
    before update on public.technician_certifications
    for each row execute function public.set_updated_at();
  end if;
end
$$;

create table if not exists public.technician_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  technician_user_id uuid not null references auth.users (id) on delete cascade,
  note text not null check (char_length(trim(note)) > 0),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_technician_notes_org_tech_created
  on public.technician_notes (organization_id, technician_user_id, created_at desc);

comment on table public.technician_notes is
  'Internal notes about a technician profile (org-scoped). Newest first in UI.';

create or replace function public.technician_notes_validate_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = new.organization_id
      and om.user_id = new.technician_user_id
      and om.status = 'active'
  ) then
    raise exception 'technician_notes: technician must be an active organization member';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_technician_notes_validate_member on public.technician_notes;
create trigger trg_technician_notes_validate_member
before insert or update of organization_id, technician_user_id on public.technician_notes
for each row execute function public.technician_notes_validate_member();

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_technician_notes_updated_at on public.technician_notes;
    create trigger trg_technician_notes_updated_at
    before update on public.technician_notes
    for each row execute function public.set_updated_at();
  end if;
end
$$;

revoke all on table public.technician_certifications from public, anon;
grant select, insert, update, delete on table public.technician_certifications to authenticated;

alter table public.technician_certifications enable row level security;

drop policy if exists "technician_certifications_select_member" on public.technician_certifications;
create policy "technician_certifications_select_member"
on public.technician_certifications
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "technician_certifications_insert" on public.technician_certifications;
create policy "technician_certifications_insert"
on public.technician_certifications
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and (
    public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
    or technician_user_id = auth.uid()
  )
);

drop policy if exists "technician_certifications_update" on public.technician_certifications;
create policy "technician_certifications_update"
on public.technician_certifications
for update
to authenticated
using (
  public.is_org_member(organization_id)
  and (
    public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
    or technician_user_id = auth.uid()
  )
)
with check (
  public.is_org_member(organization_id)
  and (
    public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
    or technician_user_id = auth.uid()
  )
);

drop policy if exists "technician_certifications_delete" on public.technician_certifications;
create policy "technician_certifications_delete"
on public.technician_certifications
for delete
to authenticated
using (
  public.is_org_member(organization_id)
  and (
    public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
    or technician_user_id = auth.uid()
  )
);

revoke all on table public.technician_notes from public, anon;
grant select, insert, update, delete on table public.technician_notes to authenticated;

alter table public.technician_notes enable row level security;

drop policy if exists "technician_notes_select_member" on public.technician_notes;
create policy "technician_notes_select_member"
on public.technician_notes
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "technician_notes_insert" on public.technician_notes;
create policy "technician_notes_insert"
on public.technician_notes
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and (
    public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
    or technician_user_id = auth.uid()
  )
);

drop policy if exists "technician_notes_update" on public.technician_notes;
create policy "technician_notes_update"
on public.technician_notes
for update
to authenticated
using (
  public.is_org_member(organization_id)
  and (
    public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
    or technician_user_id = auth.uid()
  )
)
with check (
  public.is_org_member(organization_id)
  and (
    public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
    or technician_user_id = auth.uid()
  )
);

drop policy if exists "technician_notes_delete" on public.technician_notes;
create policy "technician_notes_delete"
on public.technician_notes
for delete
to authenticated
using (
  public.is_org_member(organization_id)
  and (
    public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
    or technician_user_id = auth.uid()
  )
);
