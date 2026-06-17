/**
 * Registry-driven Growth navigation derivation (Phase 2B / 2C).
 *
 * Generates navigation models from canonical route metadata. Workspace shell nav
 * is registry-derived (Phase 2C); admin nav and Cmd+K use parity adapters while
 * preserving existing visible sources.
 */

import { listGrowthAdminNavHrefs } from "@/lib/growth/navigation/growth-admin-navigation-derivation"
import { listGrowthCommandPaletteVisibleHrefs } from "@/lib/growth/navigation/growth-command-palette-derivation"
import { listGrowthWorkspaceShellNavHrefs } from "@/lib/growth/navigation/growth-workspace-shell-navigation"
import type {
  GrowthNavigationDerivationComparison,
  GrowthNavigationItem,
  GrowthOrphanRouteReport,
  GrowthOrphanRouteReportEntry,
} from "@/lib/growth/navigation/growth-navigation-types"
import { GROWTH_ORPHAN_ROUTE_IDS } from "@/lib/growth/navigation/growth-route-catalog-data"
import {
  GROWTH_ROUTE_METADATA,
  GROWTH_WORKSPACE_BASE_PATH,
  findGrowthRouteMetadataForHref,
  type GrowthRouteMetadata,
  type GrowthRouteSection,
} from "@/lib/growth/navigation/growth-route-metadata"

export type {
  GrowthNavigationDerivationComparison,
  GrowthNavigationItem,
  GrowthOrphanRouteReport,
  GrowthOrphanRouteReportEntry,
} from "@/lib/growth/navigation/growth-navigation-types"

export { GROWTH_NAVIGATION_DERIVATION_QA_MARKER } from "@/lib/growth/navigation/growth-navigation-types"

export { findGrowthRouteMetadataForHref } from "@/lib/growth/navigation/growth-route-metadata"

function normalizeHref(href: string): string {
  return href.split("?")[0]?.split("#")[0] ?? href
}

export function isGrowthHiddenOrSystemRoute(entry: GrowthRouteMetadata): boolean {
  return entry.hidden || entry.system || entry.migrationStatus === "hidden"
}

/** Routes eligible for generated primary navigation (excludes hidden/system/deprecated/dynamic detail pages). */
export function isGrowthVisibleNavigationRoute(entry: GrowthRouteMetadata): boolean {
  if (isGrowthHiddenOrSystemRoute(entry)) return false
  if (entry.deprecated || entry.dynamic) return false
  return true
}

function resolveWorkspaceHref(entry: GrowthRouteMetadata): string | undefined {
  if (entry.path.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}`)) return entry.path
  return entry.workspacePath
}

function resolveAdminHref(entry: GrowthRouteMetadata): string | undefined {
  if (entry.path.startsWith("/admin/growth")) return entry.path
  return entry.adminPath
}

function resolvePrimaryHref(entry: GrowthRouteMetadata): string {
  const workspaceHref = resolveWorkspaceHref(entry)
  if (entry.migrated && workspaceHref) return workspaceHref
  return resolveAdminHref(entry) ?? entry.path
}

export function growthRouteMetadataToNavigationItem(entry: GrowthRouteMetadata): GrowthNavigationItem {
  const workspaceHref = resolveWorkspaceHref(entry)
  const adminHref = resolveAdminHref(entry)

  return {
    id: entry.id,
    label: entry.breadcrumbLabel ?? entry.title,
    href: resolvePrimaryHref(entry),
    adminHref,
    workspaceHref,
    futurePath: entry.futurePath,
    futureSection: entry.futureSection,
    section: entry.section,
    icon: entry.icon,
    hidden: entry.hidden,
    placeholder: entry.placeholder,
    deprecated: entry.deprecated,
    system: entry.system,
    dynamic: entry.dynamic,
    migrationStatus: entry.migrationStatus,
  }
}

export function getGrowthRoutesForSection(section: GrowthRouteSection): GrowthRouteMetadata[] {
  return GROWTH_ROUTE_METADATA.filter((entry) => entry.section === section)
}

export function getGrowthNavigationCandidates(): GrowthNavigationItem[] {
  return GROWTH_ROUTE_METADATA.filter(isGrowthVisibleNavigationRoute).map(growthRouteMetadataToNavigationItem)
}

export function getGrowthWorkspaceNavigationCandidates(): GrowthNavigationItem[] {
  return getGrowthNavigationCandidates().filter(
    (item) =>
      item.workspaceHref?.startsWith(GROWTH_WORKSPACE_BASE_PATH) ||
      item.href.startsWith(GROWTH_WORKSPACE_BASE_PATH) ||
      item.placeholder,
  )
}

export function getGrowthContentNavigationCandidates(): GrowthNavigationItem[] {
  return getGrowthNavigationCandidates().filter((item) => item.section === "content")
}

export function getGrowthAutomationNavigationCandidates(): GrowthNavigationItem[] {
  return getGrowthNavigationCandidates().filter((item) => item.section === "automation")
}

export function getGrowthIntelligenceNavigationCandidates(): GrowthNavigationItem[] {
  return getGrowthNavigationCandidates().filter((item) => item.section === "intelligence")
}

export function getGrowthSettingsNavigationCandidates(): GrowthNavigationItem[] {
  return getGrowthNavigationCandidates().filter((item) => item.section === "settings")
}

export function getGrowthSystemHiddenRoutes(): GrowthRouteMetadata[] {
  return GROWTH_ROUTE_METADATA.filter(isGrowthHiddenOrSystemRoute)
}

export function listExistingAdminNavHrefs(): string[] {
  return listGrowthAdminNavHrefs()
}

export function listExistingWorkspaceNavHrefs(): string[] {
  return listGrowthWorkspaceShellNavHrefs()
}

export function listExistingCommandPaletteHrefs(): string[] {
  return listGrowthCommandPaletteVisibleHrefs()
}

function registryPathsForEntry(entry: GrowthRouteMetadata): string[] {
  return [entry.path, entry.adminPath, entry.workspacePath, entry.futurePath].filter(
    (value): value is string => Boolean(value),
  )
}

function hrefMatchesRegistry(href: string): boolean {
  return findGrowthRouteMetadataForHref(href) !== null
}

function entryMatchesAnyHref(entry: GrowthRouteMetadata, hrefs: string[]): boolean {
  const paths = registryPathsForEntry(entry)
  return hrefs.some((href) => paths.includes(href))
}

export function getGrowthOrphanRouteReport(): GrowthOrphanRouteReport {
  const adminNavHrefs = listExistingAdminNavHrefs()
  const workspaceNavHrefs = listExistingWorkspaceNavHrefs()
  const generatedCandidates = getGrowthNavigationCandidates()
  const generatedHrefs = generatedCandidates.flatMap((item) =>
    [item.href, item.adminHref, item.workspaceHref, item.futurePath].filter(Boolean),
  ) as string[]

  const activeEntries = GROWTH_ROUTE_METADATA.filter((entry) => {
    if (entry.deprecated || isGrowthHiddenOrSystemRoute(entry) || entry.dynamic) return false
    return true
  }).map((entry) => {
    const inAdminNav = entryMatchesAnyHref(entry, adminNavHrefs)
    const inWorkspaceNav = entryMatchesAnyHref(entry, workspaceNavHrefs)
    const inGeneratedCandidates = entryMatchesAnyHref(entry, generatedHrefs)

    return {
      id: entry.id,
      path: entry.path,
      title: entry.title,
      section: entry.section,
      migrationStatus: entry.migrationStatus,
      inAdminNav,
      inWorkspaceNav,
      inGeneratedCandidates,
    }
  })

  const navGapRoutes = activeEntries.filter((entry) => !entry.inAdminNav && !entry.inWorkspaceNav)

  const orphans = navGapRoutes.filter((entry) => !entry.inGeneratedCandidates)

  const auditOrphansCoveredByGenerated = GROWTH_ORPHAN_ROUTE_IDS.every((id) =>
    generatedCandidates.some((item) => item.id === id),
  )

  return {
    orphans,
    navGapRoutes,
    auditOrphansCoveredByGenerated,
    totalOrphans: orphans.length,
    totalNavGapRoutes: navGapRoutes.length,
  }
}

export function buildGrowthNavigationDerivationComparison(): GrowthNavigationDerivationComparison {
  const adminNavHrefs = listExistingAdminNavHrefs()
  const workspaceNavHrefs = listExistingWorkspaceNavHrefs()
  const commandPaletteHrefs = listExistingCommandPaletteHrefs()
  const generatedCandidates = getGrowthNavigationCandidates()

  const unmappedAdminNav = adminNavHrefs.filter((href) => !hrefMatchesRegistry(href))
  const unmappedWorkspaceNav = workspaceNavHrefs.filter((href) => !hrefMatchesRegistry(href))
  const unmappedCommandPalette = commandPaletteHrefs.filter((href) => !hrefMatchesRegistry(href))

  const hiddenInGeneratedCandidates = getGrowthSystemHiddenRoutes()
    .map((entry) => entry.id)
    .filter((id) => generatedCandidates.some((item) => item.id === id))

  return {
    adminNavItems: adminNavHrefs.length,
    workspaceNavItems: workspaceNavHrefs.length,
    commandPaletteEntries: commandPaletteHrefs.length,
    generatedCandidates: generatedCandidates.length,
    unmappedAdminNav,
    unmappedWorkspaceNav,
    unmappedCommandPalette,
    hiddenInGeneratedCandidates,
  }
}

export function assertNoDuplicateGeneratedNavIds(items: GrowthNavigationItem[]): void {
  const ids = items.map((item) => item.id)
  if (new Set(ids).size !== ids.length) {
    throw new Error("duplicate generated navigation ids detected")
  }
}

export function assertNoDuplicateGeneratedHrefsWithinSection(items: GrowthNavigationItem[]): void {
  for (const section of ["workspace", "content", "automation", "intelligence", "settings"] as const) {
    const sectionItems = items.filter((item) => item.section === section)
    const hrefs = sectionItems.map((item) => item.href)
    if (new Set(hrefs).size !== hrefs.length) {
      throw new Error(`duplicate generated navigation hrefs in section: ${section}`)
    }
  }
}
