import "server-only"

import { getOrgPermissionsForRole, normalizeOrgMemberRole } from "@/lib/permissions/model"

/**
 * Staff may open `/portal/preview` only when they can manage portal workspace
 * settings (matches Settings → Customer Portal and portal invite tooling).
 * Managers and below do not receive this capability in the default role matrix.
 */
export function staffMayOpenPortalPreview(organizationMemberRole: string | null): boolean {
  const r = normalizeOrgMemberRole(organizationMemberRole)
  return getOrgPermissionsForRole(r).canManagePortalSettings
}
