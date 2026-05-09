-- Phase 21D: technician workflow regression after Phase 21C.
--
-- `can_read_work_order_for_role` required `work_orders.archived_at is null`, which
-- hid soft-archived jobs from DB-role technicians even when still assigned to them.
-- Assignment predicates are unchanged; unassigned rows remain unreadable for tech.
-- Writes on archived work orders stay constrained via `can_write_assigned_work_order_artifact`
-- (still requires a non-archived work order row).

create or replace function public.can_read_work_order_for_role(
  p_organization_id uuid,
  p_work_order_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select
    public.is_org_member(p_organization_id)
    and (
      not public.has_org_role(p_organization_id, array['tech'])
      or exists (
        select 1
        from public.work_orders wo
        left join public.technicians t
          on t.organization_id = wo.organization_id
         and t.id = wo.assigned_technician_id
        left join public.organization_members om
          on om.organization_id = t.organization_id
         and om.membership_id = t.membership_id
         and om.status = 'active'
        where wo.organization_id = p_organization_id
          and wo.id = p_work_order_id
          and (
            wo.assigned_user_id = auth.uid()
            or om.user_id = auth.uid()
          )
      )
    );
$$;

revoke all on function public.can_read_work_order_for_role(uuid, uuid) from public;
grant execute on function public.can_read_work_order_for_role(uuid, uuid) to authenticated;
