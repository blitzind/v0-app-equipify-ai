import {
  getEffectiveOrgPermissions,
  normalizeOrgMemberRole,
  type OrgMemberRole,
} from "@/lib/permissions/model"
import { readIsFieldResourceFromOrgMemberRow } from "@/lib/work-orders/org-member-field-resource"

const ROSTER_ASSIGNABLE_ROLES: readonly OrgMemberRole[] = ["owner", "admin", "manager", "tech"]

/**
 * Field-resource assignee picker (no `technicians` row): strict gate on
 * `organization_members.is_field_resource === true`, active membership, non-viewer role.
 */
export function isAssignableFieldResourceMember(
  row: { role: string; status: string } & Record<string, unknown>,
): boolean {
  if (row.status !== "active") return false
  const role = normalizeOrgMemberRole(row.role)
  if (!role || role === "viewer") return false
  if (!ROSTER_ASSIGNABLE_ROLES.includes(role)) return false
  return readIsFieldResourceFromOrgMemberRow(row) === true
}

/**
 * Org members who may appear as assignable field resources (Schedule, Dispatch, work orders).
 * Uses `organization_members.is_field_resource` when present; falls back to legacy rules if the
 * column is not projected (pre-migration clients).
 */
export function isEligibleFieldAssignableMember(args: {
  role: string
  status: string
  permission_profile?: string | null
  permissions_json?: unknown
  /** From `organization_members.is_field_resource` */
  isFieldResource?: boolean | null
}): boolean {
  if (args.status !== "active") return false
  const role = normalizeOrgMemberRole(args.role)
  if (!role || !ROSTER_ASSIGNABLE_ROLES.includes(role)) return false

  if (args.isFieldResource === true) return true
  if (args.isFieldResource === false) return false

  // Legacy: column missing from SELECT — preserve prior behavior until migration is live everywhere.
  const perms = getEffectiveOrgPermissions({
    role,
    permissionProfile: args.permission_profile,
    permissionsJson: args.permissions_json,
  })
  if (role === "owner" || role === "tech") return true
  return (
    perms.canEditWorkOrders ||
    perms.canManageDispatch ||
    perms.canViewDispatch ||
    perms.canUseTechnicianWorkspace
  )
}
