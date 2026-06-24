"use client"

import { usePathname, useSelectedLayoutSegments } from "next/navigation"
import { isGrowthWorkspaceSettingsPathname } from "@/lib/growth/navigation/growth-workspace-settings-paths"

/**
 * True when the active route is under `app/(growth)/growth/settings/*`.
 * Uses layout segments (primary) plus pathname (fallback) so full-width settings
 * does not depend on header injection alone.
 */
export function useGrowthWorkspaceSettingsRoute(): boolean {
  const pathname = usePathname() ?? ""
  const segments = useSelectedLayoutSegments()
  if (segments[0] === "settings") return true
  return isGrowthWorkspaceSettingsPathname(pathname)
}
