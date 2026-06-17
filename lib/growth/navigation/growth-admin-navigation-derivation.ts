/**
 * Admin Growth sidebar navigation derivation adapter (Phase 2C).
 *
 * Keeps `GROWTH_NAV_GROUP_DEFS` as the visible source of truth while validating
 * parity against the canonical route registry.
 */

import {
  GROWTH_NAV_GROUP_DEFS,
  type GrowthNavGroupDef,
  type GrowthNavItemDef,
} from "@/lib/growth/navigation/growth-navigation-destinations"
import {
  findGrowthRouteMetadataForHref,
  getGrowthRouteMetadataById,
} from "@/lib/growth/navigation/growth-route-metadata"

export const GROWTH_ADMIN_NAV_DERIVATION_QA_MARKER = "growth-admin-nav-derivation-v1" as const

export type GrowthAdminNavRegistryMapping = {
  navId: string
  label: string
  href: string
  registryRouteId: string | null
  registryTitle: string | null
  futurePlaceholder: boolean
}

export type GrowthAdminNavParityReport = {
  totalVisibleItems: number
  mappedItems: number
  unmappedHrefs: string[]
  futurePlaceholderItems: number
  mappings: GrowthAdminNavRegistryMapping[]
}

function normalizeHref(href: string): string {
  return href.split("?")[0]?.split("#")[0] ?? href
}

export function mapAdminNavItemToRegistry(item: GrowthNavItemDef): GrowthAdminNavRegistryMapping {
  const href = normalizeHref(item.href)
  const route = findGrowthRouteMetadataForHref(href)

  return {
    navId: item.id,
    label: item.label,
    href,
    registryRouteId: route?.id ?? null,
    registryTitle: route?.title ?? null,
    futurePlaceholder: Boolean(item.futurePlaceholder),
  }
}

export function buildGrowthAdminNavParityReport(): GrowthAdminNavParityReport {
  const visibleItems = GROWTH_NAV_GROUP_DEFS.flatMap((group) =>
    group.items.filter((item) => !item.futurePlaceholder),
  )

  const mappings = visibleItems.map(mapAdminNavItemToRegistry)
  const unmappedHrefs = mappings.filter((row) => !row.registryRouteId).map((row) => row.href)

  return {
    totalVisibleItems: visibleItems.length,
    mappedItems: mappings.filter((row) => row.registryRouteId).length,
    unmappedHrefs,
    futurePlaceholderItems: GROWTH_NAV_GROUP_DEFS.flatMap((group) => group.items).filter(
      (item) => item.futurePlaceholder,
    ).length,
    mappings,
  }
}

export function listGrowthAdminNavHrefs(): string[] {
  return GROWTH_NAV_GROUP_DEFS.flatMap((group) =>
    group.items.filter((item) => !item.futurePlaceholder).map((item) => normalizeHref(item.href)),
  )
}

export function listGrowthAdminNavGroups(): GrowthNavGroupDef[] {
  return GROWTH_NAV_GROUP_DEFS
}

/** Future cutover hook — returns registry-backed mappings without changing admin UI yet. */
export function getGrowthAdminNavigationRegistryMappings(): GrowthAdminNavRegistryMapping[] {
  return GROWTH_NAV_GROUP_DEFS.flatMap((group) => group.items.map(mapAdminNavItemToRegistry))
}

export function assertGrowthAdminNavRegistryParity(): void {
  const report = buildGrowthAdminNavParityReport()
  if (report.unmappedHrefs.length > 0) {
    throw new Error(`admin nav items missing registry mapping: ${report.unmappedHrefs.join(", ")}`)
  }
}

export function findAdminNavRegistryRouteId(navId: string): string | null {
  for (const group of GROWTH_NAV_GROUP_DEFS) {
    const item = group.items.find((row) => row.id === navId)
    if (item) {
      return mapAdminNavItemToRegistry(item).registryRouteId
    }
  }
  return null
}

export function getGrowthAdminNavRegistryRoute(navId: string) {
  const routeId = findAdminNavRegistryRouteId(navId)
  return routeId ? getGrowthRouteMetadataById(routeId) : null
}
