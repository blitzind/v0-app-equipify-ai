-- Public bucket for organization logos. Path: {organization_id}/{filename}
-- RLS: active org owners/admins may upload/update/delete objects under their org prefix.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-logos',
  'organization-logos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "organization_logos_public_read" on storage.objects;
create policy "organization_logos_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'organization-logos');

drop policy if exists "organization_logos_insert_org_admins" on storage.objects;
create policy "organization_logos_insert_org_admins"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'organization-logos'
    and length(trim(split_part(name, '/', 1))) > 0
    and exists (
      select 1
      from public.organization_members om
      inner join public.organizations o on o.id = om.organization_id
      where om.organization_id::text = split_part(name, '/', 1)
        and om.user_id = (select auth.uid())
        and om.status = 'active'
        and o.status = 'active'
        and om.role in ('owner', 'admin')
    )
  );

drop policy if exists "organization_logos_update_org_admins" on storage.objects;
create policy "organization_logos_update_org_admins"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'organization-logos'
    and exists (
      select 1
      from public.organization_members om
      inner join public.organizations o on o.id = om.organization_id
      where om.organization_id::text = split_part(name, '/', 1)
        and om.user_id = (select auth.uid())
        and om.status = 'active'
        and o.status = 'active'
        and om.role in ('owner', 'admin')
    )
  )
  with check (
    bucket_id = 'organization-logos'
    and exists (
      select 1
      from public.organization_members om
      inner join public.organizations o on o.id = om.organization_id
      where om.organization_id::text = split_part(name, '/', 1)
        and om.user_id = (select auth.uid())
        and om.status = 'active'
        and o.status = 'active'
        and om.role in ('owner', 'admin')
    )
  );

drop policy if exists "organization_logos_delete_org_admins" on storage.objects;
create policy "organization_logos_delete_org_admins"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'organization-logos'
    and exists (
      select 1
      from public.organization_members om
      inner join public.organizations o on o.id = om.organization_id
      where om.organization_id::text = split_part(name, '/', 1)
        and om.user_id = (select auth.uid())
        and om.status = 'active'
        and o.status = 'active'
        and om.role in ('owner', 'admin')
    )
  );
