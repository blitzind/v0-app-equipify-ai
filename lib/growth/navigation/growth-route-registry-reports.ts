/**
 * Growth route registry report helpers — derived from canonical metadata.
 * Used by diagnostics, future shell generation, migration reports, and subdomain extraction.
 */

import {
  GROWTH_ROUTE_METADATA,
  type GrowthRouteMetadata,
} from "@/lib/growth/navigation/growth-route-metadata"

export type GrowthRouteRegistryReport = {
  totalRoutes: number
  bySection: Record<GrowthRouteMetadata["section"], number>
  byMigrationStatus: Record<GrowthRouteMetadata["migrationStatus"], number>
  migratedWorkspaceRoutes: number
  adminOnlyRoutes: number
  dualRoutePairs: number
  placeholderRoutes: number
  hiddenRoutes: number
  deprecatedRoutes: number
  dynamicRoutes: number
}

function countBy<T extends string>(entries: GrowthRouteMetadata[], key: (entry: GrowthRouteMetadata) => T): Record<T, number> {
  const counts = {} as Record<T, number>
  for (const entry of entries) {
    const value = key(entry)
    counts[value] = (counts[value] ?? 0) + 1
  }
  return counts
}

export function buildGrowthRouteRegistryReport(): GrowthRouteRegistryReport {
  const dualRoutePairs = GROWTH_ROUTE_METADATA.filter(
    (entry) => entry.migrationStatus === "dual-route" && entry.path.startsWith("/growth"),
  ).length

  return {
    totalRoutes: GROWTH_ROUTE_METADATA.length,
    bySection: countBy(GROWTH_ROUTE_METADATA, (entry) => entry.section),
    byMigrationStatus: countBy(GROWTH_ROUTE_METADATA, (entry) => entry.migrationStatus),
    migratedWorkspaceRoutes: GROWTH_ROUTE_METADATA.filter((entry) => entry.migrated).length,
    adminOnlyRoutes: GROWTH_ROUTE_METADATA.filter((entry) => entry.migrationStatus === "admin-only").length,
    dualRoutePairs,
    placeholderRoutes: GROWTH_ROUTE_METADATA.filter((entry) => entry.placeholder).length,
    hiddenRoutes: GROWTH_ROUTE_METADATA.filter((entry) => entry.hidden).length,
    deprecatedRoutes: GROWTH_ROUTE_METADATA.filter((entry) => entry.deprecated).length,
    dynamicRoutes: GROWTH_ROUTE_METADATA.filter((entry) => entry.dynamic).length,
  }
}

export function getWorkspaceRoutes(): GrowthRouteMetadata[] {
  return GROWTH_ROUTE_METADATA.filter((entry) => entry.section === "workspace")
}

export function getContentRoutes(): GrowthRouteMetadata[] {
  return GROWTH_ROUTE_METADATA.filter((entry) => entry.section === "content")
}

export function getAutomationRoutes(): GrowthRouteMetadata[] {
  return GROWTH_ROUTE_METADATA.filter((entry) => entry.section === "automation")
}

export function getIntelligenceRoutes(): GrowthRouteMetadata[] {
  return GROWTH_ROUTE_METADATA.filter((entry) => entry.section === "intelligence")
}

export function getSettingsRoutes(): GrowthRouteMetadata[] {
  return GROWTH_ROUTE_METADATA.filter((entry) => entry.section === "settings")
}

export function getSystemRoutes(): GrowthRouteMetadata[] {
  return GROWTH_ROUTE_METADATA.filter((entry) => entry.section === "system")
}

export function getMigratedRoutes(): GrowthRouteMetadata[] {
  return GROWTH_ROUTE_METADATA.filter((entry) => entry.migrated)
}

export function getAdminOnlyRoutes(): GrowthRouteMetadata[] {
  return GROWTH_ROUTE_METADATA.filter((entry) => entry.migrationStatus === "admin-only")
}

export function getDualRouteEntries(): GrowthRouteMetadata[] {
  return GROWTH_ROUTE_METADATA.filter((entry) => entry.migrationStatus === "dual-route")
}

export function getPlaceholderRoutes(): GrowthRouteMetadata[] {
  return GROWTH_ROUTE_METADATA.filter((entry) => entry.placeholder)
}

export function getHiddenRoutes(): GrowthRouteMetadata[] {
  return GROWTH_ROUTE_METADATA.filter((entry) => entry.hidden)
}

export function getDeprecatedRoutes(): GrowthRouteMetadata[] {
  return GROWTH_ROUTE_METADATA.filter((entry) => entry.deprecated)
}

/**
 * Future navigation derivation map (documentation-only in Phase 2A).
 *
 * - `GROWTH_NAV_GROUP_DEFS` (`lib/growth/navigation/growth-navigation-destinations.ts`)
 *   → should filter `getAdminOnlyRoutes()` + admin twins by section + migrationStatus !== hidden
 * - `GROWTH_SHELL_NAV_GROUPS` (`components/growth/shell/growth-shell-navigation.ts`)
 *   → should filter `getMigratedRoutes()` with workspace paths + placeholder flags
 * - Cmd+K palette (`GROWTH_COMMAND_PALETTE_ENTRIES`)
 *   → should map registry entries with nav-visible flags (future) + `growthFeaturePath` rewrite
 * - Breadcrumbs (`resolveGrowthBreadcrumbs`)
 *   → should derive hierarchy from registry parent relationships (future) instead of segment switches
 */
export const GROWTH_ROUTE_REGISTRY_NAV_DERIVATION_NOTE =
  "Phase 2B: replace duplicate nav definitions with registry-driven generation using section + migrationStatus filters." as const
