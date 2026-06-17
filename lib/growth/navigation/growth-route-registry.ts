/** Growth workspace route migration registry — backed by canonical route metadata. */

import {
  findGrowthRouteMetadataByPathname,
  findGrowthRouteMetadataBySegment,
  GROWTH_ADMIN_BASE_PATH,
  GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA,
  GROWTH_ROUTE_METADATA,
  type GrowthRouteMetadata,
  GROWTH_WORKSPACE_BASE_PATH,
} from "@/lib/growth/navigation/growth-route-metadata"

export { GROWTH_ADMIN_BASE_PATH, GROWTH_WORKSPACE_BASE_PATH }

export type GrowthRouteRegistryEntry = GrowthRouteMetadata

/** All registered Growth routes (112). */
export const GROWTH_ROUTE_REGISTRY = GROWTH_ROUTE_METADATA

/** Workspace shell routes that participate in migration + breadcrumbs. */
export const GROWTH_MIGRATED_ROUTE_REGISTRY = GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA

export const GROWTH_MIGRATED_WORKSPACE_ROUTES = GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA.map(
  (entry) => entry.path,
)

function normalizeSegment(segment: string): string {
  return segment.startsWith("/") ? segment.slice(1) : segment
}

export function isGrowthWorkspaceMigratedSegment(segment: string): boolean {
  const normalized = normalizeSegment(segment)
  if (!normalized) return true
  return findGrowthRouteMetadataBySegment(normalized) !== null
}

export function resolveGrowthRouteRegistryEntry(pathname: string): GrowthRouteMetadata | null {
  return findGrowthRouteMetadataByPathname(pathname)
}

export type GrowthBreadcrumbCrumb = {
  label: string
  href?: string
  loading?: boolean
}

function metadataHref(entry: GrowthRouteMetadata): string | undefined {
  if (entry.dynamicMatch) return undefined
  return entry.path
}

export function resolveGrowthBreadcrumbs(
  pathname: string,
  options?: { detailLabel?: string | null; detailLoading?: boolean },
): GrowthBreadcrumbCrumb[] {
  const entry = findGrowthRouteMetadataByPathname(pathname)
  if (!entry) {
    return [{ label: "Growth", href: GROWTH_WORKSPACE_BASE_PATH }]
  }

  const crumbs: GrowthBreadcrumbCrumb[] = [{ label: "Growth", href: GROWTH_WORKSPACE_BASE_PATH }]
  if (entry.path === GROWTH_WORKSPACE_BASE_PATH) return crumbs

  const segment = entry.segment ?? ""

  if (segment.startsWith("share-pages/templates")) {
    crumbs.push({ label: "Share Pages", href: `${GROWTH_WORKSPACE_BASE_PATH}/share-pages` })
    crumbs.push({
      label: "Templates",
      href:
        segment === "share-pages/templates"
          ? entry.path
          : `${GROWTH_WORKSPACE_BASE_PATH}/share-pages/templates`,
    })
    if (segment !== "share-pages/templates") {
      crumbs.push({
        label: options?.detailLabel ?? entry.breadcrumbLabel ?? entry.title,
        loading: options?.detailLoading && !options.detailLabel,
      })
    }
    return crumbs
  }

  if (segment.startsWith("share-pages/") && segment !== "share-pages") {
    crumbs.push({ label: "Share Pages", href: `${GROWTH_WORKSPACE_BASE_PATH}/share-pages` })
    crumbs.push({
      label: options?.detailLabel ?? entry.breadcrumbLabel ?? entry.title,
      loading: options?.detailLoading && !options.detailLabel,
    })
    return crumbs
  }

  if (segment.startsWith("automation/")) {
    crumbs.push({ label: "Automation", href: `${GROWTH_WORKSPACE_BASE_PATH}/automation` })
    crumbs.push({
      label: options?.detailLabel ?? entry.breadcrumbLabel ?? entry.title,
      loading: options?.detailLoading && !options.detailLabel,
    })
    return crumbs
  }

  crumbs.push({ label: entry.breadcrumbLabel ?? entry.title, href: metadataHref(entry) })
  return crumbs
}

export {
  buildGrowthRouteRegistryReport,
  getAdminOnlyRoutes,
  getAutomationRoutes,
  getContentRoutes,
  getDeprecatedRoutes,
  getDualRouteEntries,
  getHiddenRoutes,
  getIntelligenceRoutes,
  getMigratedRoutes,
  getPlaceholderRoutes,
  getSettingsRoutes,
  getSystemRoutes,
  getWorkspaceRoutes,
  GROWTH_ROUTE_REGISTRY_NAV_DERIVATION_NOTE,
} from "@/lib/growth/navigation/growth-route-registry-reports"

export {
  buildGrowthNavigationDerivationComparison,
  getGrowthAutomationNavigationCandidates,
  getGrowthContentNavigationCandidates,
  getGrowthIntelligenceNavigationCandidates,
  getGrowthNavigationCandidates,
  getGrowthOrphanRouteReport,
  getGrowthRoutesForSection,
  getGrowthSettingsNavigationCandidates,
  getGrowthSystemHiddenRoutes,
  getGrowthWorkspaceNavigationCandidates,
  isGrowthHiddenOrSystemRoute,
  isGrowthVisibleNavigationRoute,
} from "@/lib/growth/navigation/growth-navigation-derivation"
export { findGrowthRouteMetadataForHref } from "@/lib/growth/navigation/growth-route-metadata"
