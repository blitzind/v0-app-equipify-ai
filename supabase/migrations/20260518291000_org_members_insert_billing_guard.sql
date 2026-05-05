-- Require billing-eligible subscription state for JWT-backed INSERT into organization_members.
-- Depends on public.can_org_create_records(uuid) from 20260518290000_rls_billing_insert_guard.sql
--
-- Bootstrap safety:
-- - First owner rows are created by public.create_organization_with_owner() (SECURITY DEFINER,
--   postgres owner). That insert runs with privileges that bypass RLS on tenant tables here.
-- - Invite flows that use the Supabase service role bypass RLS entirely.
-- - SELECT / UPDATE / DELETE policies are unchanged.

do $$
begin
  if to_regprocedure('public.can_org_create_records(uuid)') is null then
    raise exception 'Missing dependency: run migration 20260518290000_rls_billing_insert_guard.sql first.';
  end if;
end;
$$;

drop policy if exists "org_members_insert_admin_owner" on public.organization_members;

create policy "org_members_insert_admin_owner"
on public.organization_members
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin'])
  and public.can_org_create_records(organization_id)
);
