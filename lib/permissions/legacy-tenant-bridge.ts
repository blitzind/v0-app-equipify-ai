import type { OrgPermissions } from "@/lib/permissions/model"

/**
 * Maps real org permissions to legacy `useTenant().can()` keys (demo tenant matrix).
 * Prefer `useOrgPermissions().permissions` for new code.
 */
export function orgPermissionsToLegacyCan(
  perms: OrgPermissions,
  permission:
    | "canManageWorkspace"
    | "canManageBilling"
    | "canManageTeam"
    | "canCreateWorkOrders"
    | "canEditWorkOrders"
    | "canDeleteWorkOrders"
    | "canCreateEquipment"
    | "canEditEquipment"
    | "canViewInsights"
    | "canManagePlans"
    | "canViewBilling"
    | "canAccessPortal",
): boolean {
  switch (permission) {
    case "canManageWorkspace":
      return perms.canManageWorkspaceSettings
    case "canManageBilling":
      return perms.canEditOrgBilling
    case "canManageTeam":
      return perms.canManageWorkspaceSettings
    case "canCreateWorkOrders":
      return perms.canManageDispatch
    case "canEditWorkOrders":
      return perms.canManageDispatch || perms.canConsumePartsOnWorkOrders
    case "canDeleteWorkOrders":
      return perms.canManageDispatch && perms.canArchiveRecords
    case "canCreateEquipment":
      return perms.canManageWorkspaceSettings || perms.canManageInventory
    case "canEditEquipment":
      return perms.canManageInventory || perms.canConsumePartsOnWorkOrders || perms.canManageWorkspaceSettings
    case "canViewInsights":
      return perms.canViewInsights
    case "canManagePlans":
      return perms.canManageWorkspaceSettings
    case "canViewBilling":
      return perms.canViewBilling
    case "canAccessPortal":
      return perms.canManagePortalSettings
    default:
      return false
  }
}
