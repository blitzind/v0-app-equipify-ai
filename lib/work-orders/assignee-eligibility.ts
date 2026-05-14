import {
  getEffectiveOrgPermissions,
  normalizeOrgMemberRole,
  type OrgMemberRole,
} from "@/lib/permissions/model"

const ROSTER_ASSIGNABLE_ROLES: readonly OrgMemberRole[] = ["owner", "admin", "manager", "tech"]

/**
 * Org members who may appear as assignable field resources (no `technicians` row, or extras).
 * Honors commercial permission profiles (e.g. billing/sales overlays) via {@link getEffectiveOrgPermissions}.
 */
export function isEligibleFieldAssignableMember(args: {
  role: string
  status: string
  permission_profile?: string | null
  permissions_json?: unknown
}): boolean {
  if (args.status !== "active") return false
  const role = normalizeOrgMemberRole(args.role)
  if (!role || !ROSTER_ASSIGNABLE_ROLES.includes(role)) return false

  const perms = getEffectiveOrgPermissions({
    role,
    permissionProfile: args.permission_profile,
    permissionsJson: args.permissions_json,
  })

  if (role === "owner" || role === "tech") return true
  return perms.canEditWorkOrders
}
