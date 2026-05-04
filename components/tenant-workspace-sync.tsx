"use client"

import { useLayoutEffect } from "react"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useTenant } from "@/lib/tenant-store"
import { workspaceTemplateIdForOrgSlug } from "@/lib/workspace-org-map"

/**
 * Keeps tenant workspace metadata + mock bundle key aligned with the active Supabase organization
 * (does not replace the signed-in user — unlike legacy SWITCH_WORKSPACE).
 */
export function TenantWorkspaceSync() {
  const { status, organizationId, organizationSlug, organizationName } = useActiveOrganization()
  const { workspace, dispatch } = useTenant()

  useLayoutEffect(() => {
    if (status !== "ready" || !organizationId || !organizationSlug) return
    const templateId = workspaceTemplateIdForOrgSlug(organizationSlug)
    const displayName = organizationName?.trim() || workspace.name
    if (
      workspace.id === templateId &&
      workspace.name === displayName &&
      workspace.slug === organizationSlug
    ) {
      return
    }
    dispatch({
      type: "SYNC_WORKSPACE_FROM_ACTIVE_ORG",
      payload: {
        templateWorkspaceId: templateId,
        displayName,
        slug: organizationSlug,
      },
    })
  }, [status, organizationId, organizationSlug, organizationName, workspace.id, workspace.name, workspace.slug, dispatch])

  return null
}
