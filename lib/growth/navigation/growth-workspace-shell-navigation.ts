/**
 * Registry-backed Growth workspace shell navigation (Phase 2C, IA cleanup Phase 5A).
 *
 * Visible sidebar items are defined by an explicit manifest — not all registry
 * candidates — to prioritize daily operator routes while resolving hrefs from route metadata.
 */

import type { LucideIcon } from "lucide-react"
import {
  Activity,
  BookOpen,
  Inbox,
  LayoutDashboard,
  Phone,
  Settings,
  Sparkles,
  Target,
  Users,
  Workflow,
} from "lucide-react"
import {
  GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS,
} from "@/lib/growth/navigation/growth-workspace-sidebar-ia"
import { isGrowthVideoWorkspaceEnabledClient } from "@/lib/growth/videos/growth-video-route-gates"
import {
  findGrowthRouteMetadataForHref,
  getGrowthRouteMetadataById,
} from "@/lib/growth/navigation/growth-route-metadata"
import {
  GROWTH_ADMIN_BASE_PATH,
  GROWTH_WORKSPACE_BASE_PATH,
} from "@/lib/growth/navigation/growth-route-metadata-types"

export const GROWTH_WORKSPACE_SHELL_NAV_QA_MARKER = "growth-workspace-shell-nav-v7" as const

/** Back-compat QA marker used by shell components. */
export const GROWTH_SHELL_NAV_QA_MARKER = GROWTH_WORKSPACE_SHELL_NAV_QA_MARKER

export type GrowthShellNavItem = {
  id: string
  label: string
  href: string
  icon: LucideIcon
  /** True when the route lives under the dedicated `/growth` workspace shell. */
  workspaceRoute?: boolean
  /** Canonical registry route id backing this nav item. */
  registryRouteId?: string
}

export type GrowthShellNavGroup = {
  id: string
  label: string
  items: GrowthShellNavItem[]
}

type GrowthWorkspaceShellNavManifestEntry = {
  id: string
  label: string
  icon: LucideIcon
  registryRouteId: string
  workspaceRoute?: boolean
  /** When set, overrides registry-resolved href (duplicate targets like Runtime/Analytics). */
  hrefOverride?: string
}

type GrowthWorkspaceShellNavManifestGroup = {
  id: string
  label: string
  items: GrowthWorkspaceShellNavManifestEntry[]
}

/** Explicit visible workspace shell nav — subset of registry, stable order preserved. */
export const GROWTH_WORKSPACE_SHELL_NAV_MANIFEST: GrowthWorkspaceShellNavManifestGroup[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { id: "dashboard", label: "Dashboard", registryRouteId: "workspace-dashboard", icon: LayoutDashboard, workspaceRoute: true },
      { id: "leads", label: "Leads", registryRouteId: "workspace-leads", icon: Target, workspaceRoute: true },
      { id: "audiences", label: "Audiences", registryRouteId: "workspace-audiences", icon: Users, workspaceRoute: true },
      { id: "personalized-videos", label: "Personalized Videos", registryRouteId: "workspace-personalized-videos", icon: Sparkles, workspaceRoute: true },
      { id: "campaigns", label: "Campaigns", registryRouteId: "workspace-campaigns", icon: Workflow, workspaceRoute: true },
      { id: "inbox", label: "Inbox", registryRouteId: "workspace-inbox", icon: Inbox, workspaceRoute: true },
      { id: "calls", label: "Calls", registryRouteId: "workspace-calls", icon: Phone, workspaceRoute: true },
      { id: "meetings", label: "Meetings", registryRouteId: "workspace-meetings", icon: Users, workspaceRoute: true },
      { id: "settings", label: "Settings", registryRouteId: "workspace-settings", icon: Settings, workspaceRoute: true },
      { id: "runbook", label: "Runbook", registryRouteId: "workspace-runbook", icon: BookOpen, workspaceRoute: true },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    items: [
      { id: "activity", label: "Activity", registryRouteId: "workspace-activity", icon: Activity, workspaceRoute: true },
      { id: "engagement", label: "Engagement", registryRouteId: "workspace-engagement", icon: Activity, workspaceRoute: true },
    ],
  },
]

/** Phase 5A operator sidebar ids — must match manifest item ids exactly. */
export const GROWTH_WORKSPACE_SHELL_OPERATOR_NAV_IDS = GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS

function resolveManifestHref(entry: GrowthWorkspaceShellNavManifestEntry): string {
  if (entry.hrefOverride) return entry.hrefOverride

  const route = getGrowthRouteMetadataById(entry.registryRouteId)
  if (!route) {
    throw new Error(`workspace shell nav manifest references unknown registry route: ${entry.registryRouteId}`)
  }

  if (entry.workspaceRoute || route.path.startsWith(GROWTH_WORKSPACE_BASE_PATH)) {
    return route.path
  }

  if (route.path.startsWith(GROWTH_ADMIN_BASE_PATH)) {
    return route.path
  }

  return route.adminPath ?? route.path
}

export function buildGrowthWorkspaceShellNavGroups(): GrowthShellNavGroup[] {
  const videoWorkspaceEnabled = isGrowthVideoWorkspaceEnabledClient()

  return GROWTH_WORKSPACE_SHELL_NAV_MANIFEST.map((group) => ({
    id: group.id,
    label: group.label,
    items: group.items
      .filter((item) => item.id !== "videos" || videoWorkspaceEnabled)
      .map((item) => ({
        id: item.id,
        label: item.label,
        href: resolveManifestHref(item),
        icon: item.icon,
        workspaceRoute: item.workspaceRoute,
        registryRouteId: item.registryRouteId,
      })),
  }))
}

/** Canonical visible workspace shell navigation — registry-derived from manifest. */
export const GROWTH_SHELL_NAV_GROUPS: GrowthShellNavGroup[] = buildGrowthWorkspaceShellNavGroups()

/** Reserved for duplicate href targets; empty after Phase 5A sidebar IA cleanup. */
export const GROWTH_SHELL_NAV_SECONDARY_IDS = new Set<string>()

export function isGrowthShellNavItemActive(pathname: string, item: GrowthShellNavItem): boolean {
  if (GROWTH_SHELL_NAV_SECONDARY_IDS.has(item.id)) return false

  if (pathname === item.href) return true
  if (item.href === GROWTH_WORKSPACE_BASE_PATH) return pathname === GROWTH_WORKSPACE_BASE_PATH
  if (item.id === "opportunities") {
    if (pathname === `${GROWTH_WORKSPACE_BASE_PATH}/opportunities`) return true
    if (pathname === `${GROWTH_WORKSPACE_BASE_PATH}/opportunities/workspace`) return true
    if (pathname === `${GROWTH_WORKSPACE_BASE_PATH}/opportunities/readiness`) return true
    if (
      pathname === `${GROWTH_WORKSPACE_BASE_PATH}/opportunities/pipeline` ||
      pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/opportunities/pipeline/`)
    ) {
      return true
    }
    return false
  }
  if (item.workspaceRoute && pathname.startsWith(`${item.href}/`)) return true
  if (item.id === "share-pages" && pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/share-pages`)) {
    return true
  }
  if (
    item.id === "personalized-videos" &&
    (pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/videos/personalized`) ||
      pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/sendr`))
  ) {
    return true
  }
  if (item.id === "personalization" &&
    pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/personalization`)
  ) {
    return true
  }
  if (item.id === "activity" && pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/activity`)) {
    return true
  }
  if (item.id === "engagement" && pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/engagement`)) {
    return true
  }
  if (item.id === "audiences" && pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/audiences`)) {
    return true
  }
  if (item.id === "videos" && pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/videos`)) {
    return true
  }
  if (item.id === "automation-flows" && pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/automation/`)) {
    return true
  }
  return pathname.startsWith(`${item.href}/`)
}

export type GrowthWorkspaceShellNavParityIssue = {
  navId: string
  message: string
}

export function validateGrowthWorkspaceShellNavRegistryParity(): GrowthWorkspaceShellNavParityIssue[] {
  const issues: GrowthWorkspaceShellNavParityIssue[] = []

  for (const group of GROWTH_WORKSPACE_SHELL_NAV_MANIFEST) {
    for (const item of group.items) {
      const route = getGrowthRouteMetadataById(item.registryRouteId)
      if (!route) {
        issues.push({ navId: item.id, message: `missing registry route: ${item.registryRouteId}` })
        continue
      }

      const href = resolveManifestHref(item)
      if (!findGrowthRouteMetadataForHref(href)) {
        issues.push({ navId: item.id, message: `href not mapped to registry: ${href}` })
      }
    }
  }

  return issues
}

export function listGrowthWorkspaceShellNavHrefs(): string[] {
  return GROWTH_SHELL_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href.split("?")[0] ?? item.href))
}
