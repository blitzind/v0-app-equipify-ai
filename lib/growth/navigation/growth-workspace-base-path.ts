/** Base path resolver for Growth feature routes (admin vs dedicated workspace shell). */

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

export function growthFeaturePath(pathname: string | null | undefined, segment = ""): string {
  const normalized = normalizeSegment(segment)
  const onWorkspace = isGrowthWorkspacePathname(pathname)

  if (!onWorkspace) {
    return normalized ? `${GROWTH_ADMIN_BASE_PATH}/${normalized}` : GROWTH_ADMIN_BASE_PATH
  }

  if (isGrowthWorkspaceMigratedSegment(normalized)) {
    return normalized ? `${GROWTH_WORKSPACE_BASE_PATH}/${normalized}` : GROWTH_WORKSPACE_BASE_PATH
  }

  return normalized ? `${GROWTH_ADMIN_BASE_PATH}/${normalized}` : GROWTH_ADMIN_BASE_PATH
}

export { isGrowthWorkspaceMigratedSegment }
