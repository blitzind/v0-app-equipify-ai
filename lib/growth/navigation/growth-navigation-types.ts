import type { LucideIcon } from "lucide-react"
import type {
  GrowthRouteMigrationStatus,
  GrowthRouteSection,
} from "@/lib/growth/navigation/growth-route-metadata-types"

export const GROWTH_NAVIGATION_DERIVATION_QA_MARKER = "growth-navigation-derivation-v2" as const

/** Registry-derived navigation item — used for parity diagnostics and future cutover. */
export type GrowthNavigationItem = {
  id: string
  label: string
  href: string
  adminHref?: string
  workspaceHref?: string
  futurePath?: string
  futureSection?: GrowthRouteSection
  section: GrowthRouteSection
  icon?: LucideIcon
  hidden?: boolean
  placeholder?: boolean
  deprecated?: boolean
  system?: boolean
  dynamic?: boolean
  migrationStatus: GrowthRouteMigrationStatus
}

export type GrowthOrphanRouteReportEntry = {
  id: string
  path: string
  title: string
  section: GrowthRouteSection
  migrationStatus: GrowthRouteMigrationStatus
  inAdminNav: boolean
  inWorkspaceNav: boolean
  inGeneratedCandidates: boolean
}

export type GrowthOrphanRouteReport = {
  /** Routes missing from current admin + workspace nav and generated candidates. */
  orphans: GrowthOrphanRouteReportEntry[]
  /** Routes missing from current admin + workspace nav (may still appear in generated candidates). */
  navGapRoutes: GrowthOrphanRouteReportEntry[]
  /** IA audit orphan routes appear in generated navigation candidates. */
  auditOrphansCoveredByGenerated: boolean
  totalOrphans: number
  totalNavGapRoutes: number
}

export type GrowthNavigationDerivationComparison = {
  adminNavItems: number
  workspaceNavItems: number
  commandPaletteEntries: number
  generatedCandidates: number
  unmappedAdminNav: string[]
  unmappedWorkspaceNav: string[]
  unmappedCommandPalette: string[]
  hiddenInGeneratedCandidates: string[]
}
