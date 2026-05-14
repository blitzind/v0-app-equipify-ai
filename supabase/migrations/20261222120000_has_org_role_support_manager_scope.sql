-- Fix: support sessions must not satisfy has_org_role(..., array['tech']) (or other non-manager roles).
-- Otherwise can_read_customer_for_role / can_read_equipment_for_role treat support as "tech only"
-- and hide tenant lists (empty Customers, Equipment, etc.) while is_org_member is true.

create or replace function public.has_org_role(org_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.organization_members om
    inner join public.organizations o on o.id = om.organization_id
    where om.organization_id = org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and o.status = 'active'
      and om.role = any(allowed_roles)
  )
  or (
    exists (
      select 1
      from public.organization_support_sessions s
      inner join public.organizations o on o.id = s.organization_id
      where s.organization_id = org_id
        and s.user_id = auth.uid()
        and s.expires_at > now()
        and o.status = 'active'
    )
    and allowed_roles && array['owner', 'admin', 'manager']::text[]
    and not (
      coalesce(array_length(allowed_roles, 1), 0) = 1
      and allowed_roles[1] = 'owner'
    )
  );
$$;
