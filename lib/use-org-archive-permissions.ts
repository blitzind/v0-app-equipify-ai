"use client"

import { useOrgPermissions } from "@/lib/org-permissions-context"

/**
 * Archive / restore visibility — aligned with `organization_members.role` via {@link OrgPermissions.canArchiveRecords}.
 */
export function useOrgArchivePermissions() {
  const { permissions, rawRole, refresh } = useOrgPermissions()
  return {
    role: rawRole,
    canArchiveRestore: permissions.canArchiveRecords,
    refresh,
  }
}
