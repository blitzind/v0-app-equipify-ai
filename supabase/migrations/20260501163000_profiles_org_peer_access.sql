-- Allow org members to read peer profiles in the same organization (roster, technician drawer).
-- Allow org owners/admins to update profiles (e.g. full_name) of users in the same organization.

drop policy if exists "profiles_select_org_peers" on public.profiles;
create policy "profiles_select_org_peers"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om_self
    inner join public.organization_members om_peer
      on om_peer.organization_id = om_self.organization_id
    where om_self.user_id = auth.uid()
      and om_self.status = 'active'
      and om_peer.user_id = profiles.id
      and om_peer.status = 'active'
  )
);

drop policy if exists "profiles_update_org_admin" on public.profiles;
create policy "profiles_update_org_admin"
on public.profiles
for update
to authenticated
using (
  exists (
    select 1
    from public.organization_members om_admin
    inner join public.organization_members om_target
      on om_target.organization_id = om_admin.organization_id
    where om_admin.user_id = auth.uid()
      and om_admin.status = 'active'
      and om_target.user_id = profiles.id
      and om_target.status = 'active'
      and public.has_org_role(om_admin.organization_id, array['owner', 'admin'])
  )
)
with check (
  exists (
    select 1
    from public.organization_members om_admin
    inner join public.organization_members om_target
      on om_target.organization_id = om_admin.organization_id
    where om_admin.user_id = auth.uid()
      and om_admin.status = 'active'
      and om_target.user_id = profiles.id
      and om_target.status = 'active'
      and public.has_org_role(om_admin.organization_id, array['owner', 'admin'])
  )
);
