-- Public bucket for profile photos. Path: {user_id}/{filename}
-- RLS: users may write their own folder; org owners/admins may write members' folders in the same org.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Read: public bucket; explicit select for clarity (anon + authenticated)
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_org_scope" on storage.objects;
create policy "avatars_insert_org_scope"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and length(trim(split_part(name, '/', 1))) > 0
    and (
      split_part(name, '/', 1) = (select auth.uid()::text)
      or exists (
        select 1
        from public.organization_members om_a
        inner join public.organization_members om_t
          on om_t.organization_id = om_a.organization_id
        where om_a.user_id = (select auth.uid())
          and om_a.status = 'active'
          and om_a.role in ('owner', 'admin')
          and om_t.user_id::text = split_part(name, '/', 1)
          and om_t.status = 'active'
      )
    )
  );

drop policy if exists "avatars_update_org_scope" on storage.objects;
create policy "avatars_update_org_scope"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      split_part(name, '/', 1) = (select auth.uid()::text)
      or exists (
        select 1
        from public.organization_members om_a
        inner join public.organization_members om_t
          on om_t.organization_id = om_a.organization_id
        where om_a.user_id = (select auth.uid())
          and om_a.status = 'active'
          and om_a.role in ('owner', 'admin')
          and om_t.user_id::text = split_part(name, '/', 1)
          and om_t.status = 'active'
      )
    )
  );

drop policy if exists "avatars_delete_org_scope" on storage.objects;
create policy "avatars_delete_org_scope"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      split_part(name, '/', 1) = (select auth.uid()::text)
      or exists (
        select 1
        from public.organization_members om_a
        inner join public.organization_members om_t
          on om_t.organization_id = om_a.organization_id
        where om_a.user_id = (select auth.uid())
          and om_a.status = 'active'
          and om_a.role in ('owner', 'admin')
          and om_t.user_id::text = split_part(name, '/', 1)
          and om_t.status = 'active'
      )
    )
  );
