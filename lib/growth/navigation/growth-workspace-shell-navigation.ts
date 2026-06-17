/**
 * Registry-backed Growth workspace shell navigation (Phase 2C).
 *
 * Visible sidebar items are defined by an explicit manifest — not all registry
 * candidates — to preserve current IA while resolving hrefs from route metadata.
 */

import type { LucideIcon } from "lucide-react"
import {
  Activity,
  BarChart3,
  FileText,
  GitBranch,
  Handshake,
  Inbox,
  Kanban,
  LayoutDashboard,
  LayoutTemplate,
  Layers,
  MessageSquare,
  Phone,
  Radio,
  Settings,
  Shield,
  Target,
  TrendingUp,
  Users,
  Workflow,
} from "lucide-react"
import {
  findGrowthRouteMetadataForHref,
  getGrowthRouteMetadataById,
} from "@/lib/growth/navigation/growth-route-metadata"
import {
  GROWTH_ADMIN_BASE_PATH,
  GROWTH_WORKSPACE_BASE_PATH,
} from "@/lib/growth/navigation/growth-route-metadata-types"

export const GROWTH_WORKSPACE_SHELL_NAV_QA_MARKER = "growth-workspace-shell-nav-v3" as const

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
      { id: "campaigns", label: "Campaigns", registryRouteId: "workspace-campaigns", icon: Workflow, workspaceRoute: true },
      { id: "inbox", label: "Inbox", registryRouteId: "workspace-inbox", icon: Inbox, workspaceRoute: true },
      { id: "calls", label: "Calls", registryRouteId: "workspace-calls", icon: Phone, workspaceRoute: true },
      { id: "meetings", label: "Meetings", registryRouteId: "workspace-meetings", icon: Users, workspaceRoute: true },
    ],
  },
  {
    id: "content",
    label: "Content",
    items: [
      { id: "share-pages", label: "Share Pages", registryRouteId: "workspace-share-pages", icon: FileText, workspaceRoute: true },
      { id: "media-assets", label: "Media Assets", registryRouteId: "workspace-media", icon: Layers, workspaceRoute: true },
      { id: "templates", label: "Templates", registryRouteId: "workspace-share-pages-templates", icon: LayoutTemplate, workspaceRoute: true },
    ],
  },
  {
    id: "automation",
    label: "Automation",
    items: [
      { id: "automation-flows", label: "Automation Flows", registryRouteId: "workspace-automation", icon: GitBranch, workspaceRoute: true },
      { id: "approvals", label: "Approvals", registryRouteId: "admin-outreach-legacy-queue", icon: Shield },
      { id: "runtime", label: "Runtime", registryRouteId: "workspace-automation", icon: Radio, workspaceRoute: true },
      { id: "analytics", label: "Analytics", registryRouteId: "workspace-automation", icon: BarChart3, workspaceRoute: true },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    items: [
      { id: "engagement", label: "Engagement", registryRouteId: "workspace-engagement", icon: Activity, workspaceRoute: true },
      { id: "opportunities", label: "Opportunities", registryRouteId: "workspace-opportunities", icon: Target, workspaceRoute: true },
      {
        id: "opportunities-pipeline",
        label: "Pipeline",
        registryRouteId: "workspace-opportunities-pipeline",
        icon: Kanban,
        workspaceRoute: true,
      },
      { id: "conversations", label: "Conversations", registryRouteId: "workspace-conversations", icon: MessageSquare, workspaceRoute: true },
      { id: "relationships", label: "Relationships", registryRouteId: "workspace-relationships", icon: Handshake, workspaceRoute: true },
      { id: "reports", label: "Reports", registryRouteId: "admin-revenue-intelligence", icon: TrendingUp },
      { id: "signals", label: "Signals", registryRouteId: "admin-intent-pixel", icon: Radio },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      { id: "providers", label: "Providers", registryRouteId: "admin-providers", icon: Settings },
      { id: "team", label: "Team", registryRouteId: "admin-ownership", icon: Users },
      { id: "compliance", label: "Compliance", registryRouteId: "admin-providers-compliance", icon: Shield },
      { id: "settings-home", label: "Settings", registryRouteId: "workspace-settings", icon: Settings, workspaceRoute: true },
    ],
  },
]

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
  return GROWTH_WORKSPACE_SHELL_NAV_MANIFEST.map((group) => ({
    id: group.id,
    label: group.label,
    items: group.items.map((item) => ({
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

/** Nav items that share another route's href until dedicated pages exist. */
export const GROWTH_SHELL_NAV_SECONDARY_IDS = new Set(["runtime", "analytics"])

export function isGrowthShellNavItemActive(pathname: string, item: GrowthShellNavItem): boolean {
  if (GROWTH_SHELL_NAV_SECONDARY_IDS.has(item.id)) return false

  if (pathname === item.href) return true
  if (item.href === GROWTH_WORKSPACE_BASE_PATH) return pathname === GROWTH_WORKSPACE_BASE_PATH
  if (item.id === "opportunities") {
    if (pathname === `${GROWTH_WORKSPACE_BASE_PATH}/opportunities`) return true
    if (pathname === `${GROWTH_WORKSPACE_BASE_PATH}/opportunities/workspace`) return true
    return false
  }
  if (item.id === "opportunities-pipeline") {
    return (
      pathname === `${GROWTH_WORKSPACE_BASE_PATH}/opportunities/pipeline` ||
      pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/opportunities/pipeline/`)
    )
  }
  if (item.workspaceRoute && pathname.startsWith(`${item.href}/`)) return true
  if (item.id === "share-pages" && pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/share-pages/`)) {
    return !pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/share-pages/templates`)
  }
  if (item.id === "templates" && pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/share-pages/templates`)) {
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
