/** Base path resolver for Growth feature routes (admin vs dedicated workspace shell). */

import { findGrowthRouteMetadataForHref } from "@/lib/growth/navigation/growth-route-metadata"
import {
  GROWTH_ADMIN_BASE_PATH,
  GROWTH_WORKSPACE_BASE_PATH,
  isGrowthWorkspaceMigratedSegment,
} from "@/lib/growth/navigation/growth-route-registry"

export { GROWTH_ADMIN_BASE_PATH, GROWTH_WORKSPACE_BASE_PATH }

export function isGrowthWorkspacePathname(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return pathname === GROWTH_WORKSPACE_BASE_PATH || pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/`)
}

export function resolveGrowthFeatureBasePath(pathname: string | null | undefined): string {
  return isGrowthWorkspacePathname(pathname) ? GROWTH_WORKSPACE_BASE_PATH : GROWTH_ADMIN_BASE_PATH
}

function normalizeSegment(segment: string): string {
  return segment.startsWith("/") ? segment.slice(1) : segment
}

function resolveDualRouteWorkspaceHref(route: ReturnType<typeof findGrowthRouteMetadataForHref>): string | null {
  if (!route || route.migrationStatus !== "dual-route") return null
  if (route.path.startsWith(GROWTH_WORKSPACE_BASE_PATH)) return route.path
  if (route.workspacePath?.startsWith(GROWTH_WORKSPACE_BASE_PATH)) return route.workspacePath
  return null
}

export function growthFeaturePath(pathname: string | null | undefined, segment = ""): string {
  const normalized = normalizeSegment(segment)
  const onWorkspace = isGrowthWorkspacePathname(pathname)

  if (!onWorkspace) {
    return normalized ? `${GROWTH_ADMIN_BASE_PATH}/${normalized}` : GROWTH_ADMIN_BASE_PATH
  }

  if (isGrowthWorkspaceMigratedSegment(normalized)) {
    return normalized ? `${GROWTH_WORKSPACE_BASE_PATH}/${normalized}` : GROWTH_WORKSPACE_BASE_PATH
  }

  const adminCandidate = normalized ? `${GROWTH_ADMIN_BASE_PATH}/${normalized}` : GROWTH_ADMIN_BASE_PATH
  const workspaceAlias = resolveDualRouteWorkspaceHref(findGrowthRouteMetadataForHref(adminCandidate))
  if (workspaceAlias) return workspaceAlias

  return normalized ? `${GROWTH_ADMIN_BASE_PATH}/${normalized}` : GROWTH_ADMIN_BASE_PATH
}

export { isGrowthWorkspaceMigratedSegment }
