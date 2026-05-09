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

type ResourceScope = {
  workOrderId?: string | null
  customerId?: string | null
  equipmentId?: string | null
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

  const assignedWorkOrderIds = [...workOrderIds]
  if (assignedWorkOrderIds.length > 0) {
    const { data: assetRows } = await supabase
      .from("work_order_equipment")
      .select("equipment_id")
      .eq("organization_id", organizationId)
      .in("work_order_id", assignedWorkOrderIds)

    for (const row of (assetRows as Array<{ equipment_id?: string | null }> | null) ?? []) {
      if (row.equipment_id) equipmentIds.add(row.equipment_id)
    }
  }

  return {
    technicianIds: [...technicianIds],
    workOrderIds: assignedWorkOrderIds,
    customerIds: [...customerIds],
    equipmentIds: [...equipmentIds],
  }
}

export async function canAccessAssignedWorkResource(
  supabase: SupabaseClient,
  args: {
    organizationId: string
    userId: string
    permissions: Pick<OrgPermissions, "canViewAssignedWorkOrdersOnly" | "canViewAllWorkOrders">
    resource: ResourceScope
  },
): Promise<boolean> {
  if (!isAssignedWorkOnly(args.permissions)) return true

  const scope = await loadAssignedWorkScope(supabase, {
    organizationId: args.organizationId,
    userId: args.userId,
  })

  const { workOrderId, customerId, equipmentId } = args.resource
  if (workOrderId && scope.workOrderIds.includes(workOrderId)) return true
  if (customerId && scope.customerIds.includes(customerId)) return true
  if (equipmentId && scope.equipmentIds.includes(equipmentId)) return true
  return false
}

export async function canAccessAssignedAttachmentEntity(
  supabase: SupabaseClient,
  args: {
    organizationId: string
    userId: string
    permissions: Pick<
      OrgPermissions,
      | "canViewAssignedWorkOrdersOnly"
      | "canViewAllWorkOrders"
      | "canViewFinancials"
      | "canViewBilling"
      | "canViewQuotes"
    >
    entityType: string
    entityId: string
  },
): Promise<boolean> {
  if (!isAssignedWorkOnly(args.permissions)) return true

  switch (args.entityType) {
    case "work_order":
      return canAccessAssignedWorkResource(supabase, {
        organizationId: args.organizationId,
        userId: args.userId,
        permissions: args.permissions,
        resource: { workOrderId: args.entityId },
      })
    case "customer":
      return canAccessAssignedWorkResource(supabase, {
        organizationId: args.organizationId,
        userId: args.userId,
        permissions: args.permissions,
        resource: { customerId: args.entityId },
      })
    case "equipment":
      return canAccessAssignedWorkResource(supabase, {
        organizationId: args.organizationId,
        userId: args.userId,
        permissions: args.permissions,
        resource: { equipmentId: args.entityId },
      })
    case "calibration_record": {
      const { data } = await supabase
        .from("calibration_records")
        .select("work_order_id, equipment_id")
        .eq("organization_id", args.organizationId)
        .eq("id", args.entityId)
        .maybeSingle()
      const row = data as { work_order_id?: string | null; equipment_id?: string | null } | null
      if (!row) return false
      return canAccessAssignedWorkResource(supabase, {
        organizationId: args.organizationId,
        userId: args.userId,
        permissions: args.permissions,
        resource: {
          workOrderId: row.work_order_id ?? null,
          equipmentId: row.equipment_id ?? null,
        },
      })
    }
    case "invoice":
      return args.permissions.canViewFinancials || args.permissions.canViewBilling
    case "quote":
      return args.permissions.canViewQuotes
    default:
      return false
  }
}
