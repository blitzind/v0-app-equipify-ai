-- Phase 21E: technician stored-signature self-service (direct Supabase paths).
--
-- Client helpers in lib/technicians/signature-storage.ts upload to
-- equipify-signatures and PATCH technicians.signature_url — both were manager+.
-- Allow DB-role technicians to mutate only their own linked technician row’s
-- signature columns and corresponding storage objects; managers unchanged.

-- ─── Storage: own technician folder only ─────────────────────────────────────

create or replace function public.is_own_technician_signature_storage_path(
  p_organization_id uuid,
  p_storage_path text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select
    split_part(p_storage_path, '/', 1)::uuid = p_organization_id
    and split_part(p_storage_path, '/', 2) = 'technicians'
    and split_part(p_storage_path, '/', 3) ~ '^[0-9a-fA-F-]{36}$'
    and exists (
      select 1
      from public.technicians t
      inner join public.organization_members om
        on om.organization_id = t.organization_id
       and om.membership_id = t.membership_id
       and om.status = 'active'
       and om.user_id = auth.uid()
      where t.organization_id = p_organization_id
        and t.id = split_part(p_storage_path, '/', 3)::uuid
    );
$$;

revoke all on function public.is_own_technician_signature_storage_path(uuid, text) from public;
grant execute on function public.is_own_technician_signature_storage_path(uuid, text) to authenticated;
alter function public.is_own_technician_signature_storage_path(uuid, text) owner to postgres;

drop policy if exists "equipify_signatures_insert_own_tech" on storage.objects;
create policy "equipify_signatures_insert_own_tech"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'equipify-signatures'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  and public.has_org_role(split_part(name, '/', 1)::uuid, array['tech']::text[])
  and public.is_own_technician_signature_storage_path(split_part(name, '/', 1)::uuid, name)
);

drop policy if exists "equipify_signatures_update_own_tech" on storage.objects;
create policy "equipify_signatures_update_own_tech"
on storage.objects for update to authenticated
using (
  bucket_id = 'equipify-signatures'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  and public.has_org_role(split_part(name, '/', 1)::uuid, array['tech']::text[])
  and public.is_own_technician_signature_storage_path(split_part(name, '/', 1)::uuid, name)
)
with check (
  bucket_id = 'equipify-signatures'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  and public.has_org_role(split_part(name, '/', 1)::uuid, array['tech']::text[])
  and public.is_own_technician_signature_storage_path(split_part(name, '/', 1)::uuid, name)
);

drop policy if exists "equipify_signatures_delete_own_tech" on storage.objects;
create policy "equipify_signatures_delete_own_tech"
on storage.objects for delete to authenticated
using (
  bucket_id = 'equipify-signatures'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  and public.has_org_role(split_part(name, '/', 1)::uuid, array['tech']::text[])
  and public.is_own_technician_signature_storage_path(split_part(name, '/', 1)::uuid, name)
);

-- ─── technicians: policy + column guard for tech self-service ───────────────

create or replace function public.prevent_technicians_tech_non_signature_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if public.has_org_role(old.organization_id, array['owner', 'admin', 'manager']::text[]) then
    return new;
  end if;

  if not public.has_org_role(old.organization_id, array['tech']::text[]) then
    return new;
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = old.organization_id
      and om.membership_id = old.membership_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  ) then
    raise exception 'technician profile update is not allowed for this membership';
  end if;

  if new.id is distinct from old.id
    or new.organization_id is distinct from old.organization_id
    or new.membership_id is distinct from old.membership_id
    or new.full_name is distinct from old.full_name
    or new.email is distinct from old.email
    or new.phone is distinct from old.phone
    or new.avatar_url is distinct from old.avatar_url
    or new.job_title is distinct from old.job_title
    or new.region is distinct from old.region
    or new.skills is distinct from old.skills
    or new.availability_status is distinct from old.availability_status
    or new.start_date is distinct from old.start_date
    or new.labor_rate_cents is distinct from old.labor_rate_cents
    or new.operational_status is distinct from old.operational_status
    or new.notes is distinct from old.notes
    or new.created_at is distinct from old.created_at
    or new.is_sample is distinct from old.is_sample
  then
    raise exception 'only signature fields may be updated for this role';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_technicians_tech_non_signature_update() from public, anon, authenticated;
alter function public.prevent_technicians_tech_non_signature_update() owner to postgres;

drop trigger if exists trg_technicians_prevent_tech_non_signature_update on public.technicians;
create trigger trg_technicians_prevent_tech_non_signature_update
before update on public.technicians
for each row execute function public.prevent_technicians_tech_non_signature_update();

drop policy if exists "technicians_update_own_signature_tech" on public.technicians;
create policy "technicians_update_own_signature_tech"
on public.technicians
for update
to authenticated
using (
  public.has_org_role(organization_id, array['tech']::text[])
  and membership_id is not null
  and exists (
    select 1
    from public.organization_members om
    where om.organization_id = technicians.organization_id
      and om.membership_id = technicians.membership_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
)
with check (
  public.has_org_role(organization_id, array['tech']::text[])
  and membership_id is not null
  and exists (
    select 1
    from public.organization_members om
    where om.organization_id = technicians.organization_id
      and om.membership_id = technicians.membership_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);
