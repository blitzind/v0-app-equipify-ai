import "server-only"

import type { OrganizationMemberRecord } from "@/lib/api/org-role"
import {
  getEffectiveOrgPermissions,
  getOrgPermissionsForRole,
  normalizeOrgMemberRole,
} from "@/lib/permissions/model"

/**
 * Staff may open `/portal/preview` when effective permissions include
 * `canManagePortalSettings` (matches Settings → Customer Portal and portal
 * invite tooling). Honors commercial `permission_profile` and optional
 * `permissions_json` overrides — not raw DB role alone.
 */
export function staffMayOpenPortalPreviewFromMembership(
  member: OrganizationMemberRecord | null,
): boolean {
  if (!member?.role?.trim()) return false
  const perms = getEffectiveOrgPermissions({
    role: normalizeOrgMemberRole(member.role),
    permissionProfile: member.permission_profile,
    permissionsJson: member.permissions_json,
  })
  return perms.canManagePortalSettings
}

/**
 * @deprecated Prefer `staffMayOpenPortalPreviewFromMembership` with a full
 * membership row so profiles/overlays apply. This uses DB role defaults only.
 */
export function staffMayOpenPortalPreview(organizationMemberRole: string | null): boolean {
  const r = normalizeOrgMemberRole(organizationMemberRole)
  return getOrgPermissionsForRole(r).canManagePortalSettings
}
