/**
 * Opportunities workspace tab navigation (Phase 7E).
 *
 * Pipeline and Readiness are contextual tabs under Opportunities — not sidebar destinations.
 */

import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"

export const GROWTH_OPPORTUNITIES_WORKSPACE_NAV_QA_MARKER = "growth-opportunities-workspace-nav-v1" as const

export type GrowthOpportunitiesWorkspaceTab = {
  id: string
  label: string
  href: string
  description: string
}

export const GROWTH_OPPORTUNITIES_WORKSPACE_TABS: GrowthOpportunitiesWorkspaceTab[] = [
  {
    id: "overview",
    label: "Overview",
    href: `${GROWTH_WORKSPACE_BASE_PATH}/opportunities`,
    description: "Pipeline snapshot, priority accounts, and next best actions.",
  },
  {
    id: "pipeline",
    label: "Pipeline",
    href: `${GROWTH_WORKSPACE_BASE_PATH}/opportunities/pipeline`,
    description: "Pipeline management, stage progression, opportunity inspection, and forecast views.",
  },
  {
    id: "readiness",
    label: "Readiness",
    href: `${GROWTH_WORKSPACE_BASE_PATH}/opportunities/readiness`,
    description: "Enrollment readiness, execution readiness, diagnostics, and recommendations.",
  },
]

const TAB_ROUTES = new Set(GROWTH_OPPORTUNITIES_WORKSPACE_TABS.map((tab) => tab.href))

export function isGrowthOpportunitiesTabRoute(pathname: string): boolean {
  if (TAB_ROUTES.has(pathname)) return true
  return (
    pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/opportunities/pipeline/`) ||
    pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/opportunities/readiness/`)
  )
}

export function resolveGrowthOpportunitiesActiveTabId(pathname: string): string | null {
  if (pathname === `${GROWTH_WORKSPACE_BASE_PATH}/opportunities`) return "overview"
  if (
    pathname === `${GROWTH_WORKSPACE_BASE_PATH}/opportunities/pipeline` ||
    pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/opportunities/pipeline/`)
  ) {
    return "pipeline"
  }
  if (
    pathname === `${GROWTH_WORKSPACE_BASE_PATH}/opportunities/readiness` ||
    pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/opportunities/readiness/`)
  ) {
    return "readiness"
  }
  return null
}

export function getGrowthOpportunitiesWorkspaceTabById(id: string): GrowthOpportunitiesWorkspaceTab | null {
  return GROWTH_OPPORTUNITIES_WORKSPACE_TABS.find((tab) => tab.id === id) ?? null
}
