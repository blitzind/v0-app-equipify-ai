import {
  Activity,
  Bot,
  FileText,
  GitBranch,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  Layers,
  Phone,
  Settings,
  Target,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react"
import { GROWTH_ROUTE_CATALOG_INPUTS } from "@/lib/growth/navigation/growth-route-catalog-data"
import {
  GROWTH_ADMIN_BASE_PATH,
  GROWTH_ROUTE_METADATA_QA_MARKER,
  GROWTH_WORKSPACE_BASE_PATH,
  type GrowthRouteMetadata,
  type GrowthRouteMigrationStatus,
  type GrowthRouteSection,
} from "@/lib/growth/navigation/growth-route-metadata-types"

export {
  GROWTH_ADMIN_BASE_PATH,
  GROWTH_ROUTE_METADATA_QA_MARKER,
  GROWTH_ROUTE_MIGRATION_STATUSES,
  GROWTH_ROUTE_SECTIONS,
  GROWTH_WORKSPACE_BASE_PATH,
  type GrowthRouteMetadata,
  type GrowthRouteMigrationStatus,
  type GrowthRouteSection,
} from "@/lib/growth/navigation/growth-route-metadata-types"

export { GROWTH_ORPHAN_ROUTE_IDS } from "@/lib/growth/navigation/growth-route-catalog-data"

const WORKSPACE_ICON_BY_ID: Record<string, LucideIcon> = {
  "workspace-dashboard": LayoutDashboard,
  "workspace-share-pages": FileText,
  "workspace-share-pages-manage": FileText,
  "workspace-share-pages-workspace": FileText,
  "workspace-share-pages-detail": FileText,
  "workspace-share-pages-templates": LayoutTemplate,
  "workspace-share-pages-templates-new": LayoutTemplate,
  "workspace-share-pages-templates-edit": LayoutTemplate,
  "workspace-share-pages-templates-preview": LayoutTemplate,
  "workspace-automation": GitBranch,
  "workspace-automation-new": GitBranch,
  "workspace-automation-edit": GitBranch,
  "workspace-engagement": Activity,
  "workspace-ai-operations": Bot,
  "workspace-leads": Target,
  "workspace-campaigns": Workflow,
  "workspace-inbox": Inbox,
  "workspace-calls": Phone,
  "workspace-meetings": Users,
  "workspace-media": Layers,
  "workspace-settings": Settings,
}

function buildRouteMetadata(input: (typeof GROWTH_ROUTE_CATALOG_INPUTS)[number]): GrowthRouteMetadata {
  return {
    id: input.id,
    path: input.path,
    adminPath: input.adminPath,
    workspacePath: input.workspacePath,
    segment: input.segment,
    title: input.title,
    breadcrumbLabel: input.breadcrumbLabel,
    section: input.section,
    icon: WORKSPACE_ICON_BY_ID[input.id],
    migrated: input.migrated ?? false,
    placeholder: input.placeholder ?? false,
    hidden: input.hidden ?? false,
    system: input.system ?? false,
    dynamic: input.dynamic ?? false,
    deprecated: input.deprecated ?? false,
    migrationStatus: input.migrationStatus,
    dynamicMatch: input.dynamicMatch,
    futurePath: input.futurePath,
    futureSection: input.futureSection,
  }
}

/** Canonical registry for all Growth Engine page routes (112 entries). */
export const GROWTH_ROUTE_METADATA: GrowthRouteMetadata[] =
  GROWTH_ROUTE_CATALOG_INPUTS.map(buildRouteMetadata)

/** Workspace shell routes that participate in segment resolution and breadcrumbs. */
export const GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA: GrowthRouteMetadata[] = GROWTH_ROUTE_METADATA.filter(
  (entry) => entry.migrated && entry.path.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}`),
)

export function getGrowthRouteMetadataById(id: string): GrowthRouteMetadata | null {
  return GROWTH_ROUTE_METADATA.find((entry) => entry.id === id) ?? null
}

export function getGrowthRouteMetadataByPath(path: string): GrowthRouteMetadata | null {
  return GROWTH_ROUTE_METADATA.find((entry) => entry.path === path) ?? null
}

export function findGrowthRouteMetadataBySegment(segment: string): GrowthRouteMetadata | null {
  const normalized = segment.startsWith("/") ? segment.slice(1) : segment
  const migrated = GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA

  if (!normalized) {
    return migrated.find((entry) => entry.segment === "") ?? null
  }

  const exact = migrated.find((entry) => entry.segment === normalized)
  if (exact) return exact

  return migrated.find((entry) => entry.dynamicMatch?.test(normalized)) ?? null
}

/** Resolve workspace pathname metadata — unchanged behavior for `/growth/*` shell routing. */
export function findGrowthRouteMetadataByPathname(pathname: string): GrowthRouteMetadata | null {
  if (pathname === GROWTH_WORKSPACE_BASE_PATH) {
    return GROWTH_MIGRATED_WORKSPACE_ROUTE_METADATA.find((entry) => entry.path === GROWTH_WORKSPACE_BASE_PATH) ?? null
  }
  if (!pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/`)) return null

  const relative = pathname.slice(GROWTH_WORKSPACE_BASE_PATH.length + 1)
  return findGrowthRouteMetadataBySegment(relative)
}

/** Resolve any registered Growth route by exact path (admin or workspace). */
export function findGrowthRouteMetadataByAnyPath(path: string): GrowthRouteMetadata | null {
  return getGrowthRouteMetadataByPath(path)
}

function registryPathsForEntry(entry: GrowthRouteMetadata): string[] {
  return [entry.path, entry.adminPath, entry.workspacePath, entry.futurePath].filter(
    (value): value is string => Boolean(value),
  )
}

function normalizeHrefForLookup(href: string): string {
  return href.split("?")[0]?.split("#")[0] ?? href
}

/** Resolve registry metadata for a nav href (admin, workspace, future, or prefix match). */
export function findGrowthRouteMetadataForHref(href: string): GrowthRouteMetadata | null {
  const normalized = normalizeHrefForLookup(href)

  const exact = GROWTH_ROUTE_METADATA.find((entry) => registryPathsForEntry(entry).some((path) => path === normalized))
  if (exact) return exact

  return (
    GROWTH_ROUTE_METADATA.find((entry) =>
      registryPathsForEntry(entry).some((path) => normalized.startsWith(`${path}/`) || path.startsWith(`${normalized}/`)),
    ) ?? null
  )
}

export function listGrowthRouteMetadataBySection(section: GrowthRouteSection): GrowthRouteMetadata[] {
  return GROWTH_ROUTE_METADATA.filter((entry) => entry.section === section)
}

export function listGrowthRouteMetadataByMigrationStatus(
  status: GrowthRouteMigrationStatus,
): GrowthRouteMetadata[] {
  return GROWTH_ROUTE_METADATA.filter((entry) => entry.migrationStatus === status)
}
