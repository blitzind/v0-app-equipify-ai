/**
 * Cmd+K Growth command palette registry mapping (Phase 2C).
 *
 * Preserves existing palette labels/behavior while resolving destinations through
 * the canonical route registry when possible.
 */

import { GROWTH_COMMAND_REGISTRY, type GrowthCommandRegistryEntry } from "@/lib/growth/navigation/growth-command-registry"
import {
  GROWTH_COMMAND_PALETTE_ENTRIES,
  type GrowthCommandPaletteEntry,
} from "@/lib/growth/navigation/growth-navigation-destinations"
import { findGrowthRouteMetadataForHref } from "@/lib/growth/navigation/growth-route-metadata"
import {
  GROWTH_ADMIN_BASE_PATH,
  GROWTH_WORKSPACE_BASE_PATH,
} from "@/lib/growth/navigation/growth-route-metadata-types"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"

export const GROWTH_COMMAND_PALETTE_DERIVATION_QA_MARKER = "growth-command-palette-derivation-v1" as const

/** Hidden/system registry routes already intentionally exposed in Cmd+K (preserve existing behavior). */
export const GROWTH_COMMAND_PALETTE_INTENTIONALLY_EXPOSED_HIDDEN_IDS = [
  "inbox-diagnostics",
  "experiments",
] as const

export type GrowthCommandPaletteRegistryMapping = {
  id: string
  label: string
  href: string
  registryRouteId: string | null
  registryTitle: string | null
  hiddenRoute: boolean
  source: "palette" | "command-registry"
}

function normalizeHref(href: string): string {
  return href.split("?")[0]?.split("#")[0] ?? href
}

function isHiddenRegistryRoute(route: NonNullable<ReturnType<typeof findGrowthRouteMetadataForHref>>): boolean {
  return route.hidden || route.system || route.migrationStatus === "hidden"
}

export function mapGrowthCommandHrefToRegistry(href: string): GrowthCommandPaletteRegistryMapping["registryRouteId"] {
  return findGrowthRouteMetadataForHref(href)?.id ?? null
}

export function buildGrowthCommandPaletteRegistryMappings(): GrowthCommandPaletteRegistryMapping[] {
  const paletteRows: GrowthCommandPaletteRegistryMapping[] = GROWTH_COMMAND_PALETTE_ENTRIES.map((entry) => {
    const href = normalizeHref(entry.href)
    const route = findGrowthRouteMetadataForHref(href)
    return {
      id: entry.id,
      label: entry.label,
      href,
      registryRouteId: route?.id ?? null,
      registryTitle: route?.title ?? null,
      hiddenRoute: route ? isHiddenRegistryRoute(route) : false,
      source: "palette",
    }
  })

  const commandRows: GrowthCommandPaletteRegistryMapping[] = GROWTH_COMMAND_REGISTRY.map((entry) => {
    const href = normalizeHref(entry.href)
    const route = findGrowthRouteMetadataForHref(href)
    return {
      id: entry.id,
      label: entry.label,
      href,
      registryRouteId: route?.id ?? null,
      registryTitle: route?.title ?? null,
      hiddenRoute: route ? isHiddenRegistryRoute(route) : false,
      source: "command-registry",
    }
  })

  return [...paletteRows, ...commandRows]
}

/** Keep Cmd+K destinations inside `/growth/*` when opened from the workspace shell. */
export function resolveGrowthCommandPaletteHref(pathname: string, href: string): string {
  if (pathname !== GROWTH_WORKSPACE_BASE_PATH && !pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/`)) {
    return href
  }
  if (href !== GROWTH_ADMIN_BASE_PATH && !href.startsWith(`${GROWTH_ADMIN_BASE_PATH}/`)) {
    return href
  }

  const queryIndex = href.indexOf("?")
  const baseHref = queryIndex >= 0 ? href.slice(0, queryIndex) : href
  const query = queryIndex >= 0 ? href.slice(queryIndex) : ""
  const segment = baseHref === GROWTH_ADMIN_BASE_PATH ? "" : baseHref.slice(GROWTH_ADMIN_BASE_PATH.length + 1)
  return `${growthFeaturePath(pathname, segment)}${query}`
}

export function resolveGrowthCommandPaletteEntryHref(
  pathname: string,
  entry: Pick<GrowthCommandPaletteEntry, "href"> | Pick<GrowthCommandRegistryEntry, "href">,
): string {
  return resolveGrowthCommandPaletteHref(pathname, entry.href)
}

export function listGrowthCommandPaletteVisibleHrefs(): string[] {
  const hrefs = [
    ...GROWTH_COMMAND_PALETTE_ENTRIES.map((entry) => normalizeHref(entry.href)),
    ...GROWTH_COMMAND_REGISTRY.map((entry) => normalizeHref(entry.href)),
  ]
  return [...new Set(hrefs)]
}

export function assertGrowthCommandPaletteRegistryParity(): void {
  const mappings = buildGrowthCommandPaletteRegistryMappings()
  const unmapped = mappings.filter((row) => !row.registryRouteId).map((row) => `${row.id}:${row.href}`)
  if (unmapped.length > 0) {
    throw new Error(`Cmd+K destinations missing registry mapping: ${unmapped.join(", ")}`)
  }

  const hiddenExposed = mappings.filter((row) => row.hiddenRoute)
  const unexpectedHidden = hiddenExposed.filter(
    (row) => !GROWTH_COMMAND_PALETTE_INTENTIONALLY_EXPOSED_HIDDEN_IDS.includes(
      row.id as (typeof GROWTH_COMMAND_PALETTE_INTENTIONALLY_EXPOSED_HIDDEN_IDS)[number],
    ),
  )
  if (unexpectedHidden.length > 0) {
    throw new Error(
      `Cmd+K exposes unexpected hidden/system registry routes: ${unexpectedHidden.map((row) => row.id).join(", ")}`,
    )
  }
}
