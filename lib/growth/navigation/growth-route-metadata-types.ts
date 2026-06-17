import type { LucideIcon } from "lucide-react"

export const GROWTH_WORKSPACE_BASE_PATH = "/growth" as const
export const GROWTH_ADMIN_BASE_PATH = "/admin/growth" as const

export const GROWTH_ROUTE_METADATA_QA_MARKER = "growth-route-metadata-v8" as const

export const GROWTH_ROUTE_SECTIONS = [
  "workspace",
  "content",
  "automation",
  "intelligence",
  "settings",
  "system",
] as const

export type GrowthRouteSection = (typeof GROWTH_ROUTE_SECTIONS)[number]

export const GROWTH_ROUTE_MIGRATION_STATUSES = [
  "workspace",
  "admin-only",
  "dual-route",
  "placeholder",
  "hidden",
] as const

export type GrowthRouteMigrationStatus = (typeof GROWTH_ROUTE_MIGRATION_STATUSES)[number]

export type GrowthRouteMetadata = {
  id: string
  path: string
  adminPath?: string
  workspacePath?: string
  segment?: string
  title: string
  breadcrumbLabel?: string
  section: GrowthRouteSection
  icon?: LucideIcon
  migrated: boolean
  placeholder: boolean
  hidden: boolean
  system: boolean
  dynamic: boolean
  deprecated: boolean
  migrationStatus: GrowthRouteMigrationStatus
  /** When set, matches relative workspace paths for migrated shell routing. */
  dynamicMatch?: RegExp
  /** Planned workspace path after settings migration (not active yet). */
  futurePath?: string
  /** Planned IA section after migration (defaults to current section when omitted). */
  futureSection?: GrowthRouteSection
}
