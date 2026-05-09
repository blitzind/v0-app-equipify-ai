import type { SupabaseClient } from "@supabase/supabase-js"
import type { OrgPermissions } from "@/lib/permissions/model"

export function isAssignedWorkOnly(perms: Pick<OrgPermissions, "canViewAssignedWorkOrdersOnly" | "canViewAllWorkOrders">): boolean {
  return perms.canViewAssignedWorkOrdersOnly && !perms.canViewAllWorkOrders
}

export type AssignedWorkScope = {
  technicianIds: string[]
  workOrderIds: string[]
  customerIds: string[]
  equipmentIds: string[]
}

export async function loadAssignedWorkScope(
  supabase: SupabaseClient,
  args: { organizationId: string; userId: string },
): Promise<AssignedWorkScope> {
  const { organizationId, userId } = args
  const technicianIds = new Set<string>()

  const { data: memberRows } = await supabase
    .from("organization_members")
    .select("membership_id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")

  const membershipIds = ((memberRows as Array<{ membership_id?: string | null }> | null) ?? [])
    .map((row) => row.membership_id)
    .filter((id): id is string => Boolean(id))

  if (membershipIds.length > 0) {
    const { data: techRows } = await supabase
      .from("technicians")
      .select("id")
      .eq("organization_id", organizationId)
      .in("membership_id", membershipIds)

    for (const row of (techRows as Array<{ id: string }> | null) ?? []) {
      technicianIds.add(row.id)
    }
  }

  const assignedRows: Array<{
    id: string
    customer_id: string | null
    equipment_id: string | null
  }> = []

  const { data: userAssignedRows } = await supabase
    .from("work_orders")
    .select("id, customer_id, equipment_id")
    .eq("organization_id", organizationId)
    .eq("assigned_user_id", userId)
    .is("archived_at", null)
    .limit(1000)

  assignedRows.push(...(((userAssignedRows as typeof assignedRows | null) ?? [])))

  if (technicianIds.size > 0) {
    const { data: techAssignedRows } = await supabase
      .from("work_orders")
      .select("id, customer_id, equipment_id")
      .eq("organization_id", organizationId)
      .in("assigned_technician_id", [...technicianIds])
      .is("archived_at", null)
      .limit(1000)

    assignedRows.push(...(((techAssignedRows as typeof assignedRows | null) ?? [])))
  }

  const workOrderIds = new Set<string>()
  const customerIds = new Set<string>()
  const equipmentIds = new Set<string>()

  for (const row of assignedRows) {
    workOrderIds.add(row.id)
    if (row.customer_id) customerIds.add(row.customer_id)
    if (row.equipment_id) equipmentIds.add(row.equipment_id)
  }

  return {
    technicianIds: [...technicianIds],
    workOrderIds: [...workOrderIds],
    customerIds: [...customerIds],
    equipmentIds: [...equipmentIds],
  }
}
