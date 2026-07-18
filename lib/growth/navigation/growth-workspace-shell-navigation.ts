/**
 * Registry-backed Growth workspace shell navigation (Phase 2C, IA cleanup Phase 5A).
 *
 * Visible sidebar items are defined by an explicit manifest — not all registry
 * candidates — to prioritize daily operator routes while resolving hrefs from route metadata.
 */

import type { LucideIcon } from "lucide-react"
import {
  Activity,
  Bot,
  GraduationCap,
  Handshake,
  Inbox,
  Home,
  MessageSquare,
  Phone,
  Settings,
  ShieldCheck,
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
  AI_OS_ADVANCED_NAV_GROUP_LABEL,
  AI_OS_HOME_NAV_LABEL,
} from "@/lib/workspace/ai-os-workspace-branding"
import {
  isGrowthWorkspaceFirstUx1aEnabled,
  isGrowthWorkspaceFirstUx1aEnabledClient,
} from "@/lib/growth/navigation/growth-workspace-first-ux-1a-feature"
import {
  GROWTH_WORKSPACE_FIRST_UX_1A_NAV_MANIFEST,
  type GrowthWorkspaceFirstUx1aNavManifestEntry,
  type GrowthWorkspaceFirstUx1aNavManifestGroup,
} from "@/lib/growth/navigation/growth-workspace-first-ux-1a-navigation"
import {
  GROWTH_ADMIN_BASE_PATH,
  GROWTH_WORKSPACE_BASE_PATH,
} from "@/lib/growth/navigation/growth-route-metadata-types"

export const GROWTH_WORKSPACE_SHELL_NAV_QA_MARKER = "growth-workspace-shell-nav-v11" as const

export const GROWTH_WORKSPACE_SHELL_NAV_UX_1A_QA_MARKER = "growth-workspace-shell-nav-v12" as const

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

function toShellManifestEntry(
  entry: GrowthWorkspaceFirstUx1aNavManifestEntry,
): GrowthWorkspaceShellNavManifestEntry {
  return {
    id: entry.id,
    label: entry.label,
    icon: entry.icon,
    registryRouteId: entry.registryRouteId,
    workspaceRoute: entry.workspaceRoute,
    hrefOverride: entry.hrefOverride,
  }
}

function toShellManifestGroup(
  group: GrowthWorkspaceFirstUx1aNavManifestGroup,
): GrowthWorkspaceShellNavManifestGroup {
  return {
    id: group.id,
    label: group.label,
    items: group.items.map(toShellManifestEntry),
  }
}

/** Legacy operator sidebar — active when UX-1A flag is off. */
export const GROWTH_WORKSPACE_SHELL_NAV_MANIFEST: GrowthWorkspaceShellNavManifestGroup[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { id: "dashboard", label: AI_OS_HOME_NAV_LABEL, registryRouteId: "workspace-dashboard", icon: Home, workspaceRoute: true },
      { id: "operations", label: "Operations", registryRouteId: "workspace-sales-operations-center", icon: Bot, workspaceRoute: true },
      { id: "training", label: "Training", registryRouteId: "workspace-training", icon: GraduationCap, workspaceRoute: true },
      { id: "about-ai", label: "About Your AI", registryRouteId: "workspace-ava-about", icon: Bot, workspaceRoute: true },
      { id: "approvals", label: "Completed Work", registryRouteId: "workspace-human-approval-center", icon: ShieldCheck, workspaceRoute: true },
      { id: "leads", label: "Leads", registryRouteId: "workspace-leads", icon: Target, workspaceRoute: true },
      { id: "audiences", label: "Audiences", registryRouteId: "workspace-audiences", icon: Users, workspaceRoute: true },
      { id: "personalized-videos", label: "Personalized Videos", registryRouteId: "workspace-personalized-videos", icon: Sparkles, workspaceRoute: true },
      { id: "campaigns", label: "Campaigns", registryRouteId: "workspace-campaigns", icon: Workflow, workspaceRoute: true },
      { id: "objectives", label: "Objectives", registryRouteId: "workspace-objectives", icon: Target, workspaceRoute: true },
      { id: "inbox", label: "Inbox", registryRouteId: "workspace-inbox", icon: Inbox, workspaceRoute: true },
      { id: "calls", label: "Calls", registryRouteId: "workspace-calls", icon: Phone, workspaceRoute: true },
      { id: "meetings", label: "Meetings", registryRouteId: "workspace-meetings", icon: Users, workspaceRoute: true },
      { id: "settings", label: "Settings", registryRouteId: "workspace-settings", icon: Settings, workspaceRoute: true },
    ],
  },
  {
    id: "revenue",
    label: "Revenue",
    items: [
      {
        id: "conversations",
        label: "Conversations",
        registryRouteId: "workspace-conversations",
        icon: MessageSquare,
        workspaceRoute: true,
      },
      {
        id: "opportunities",
        label: "Opportunities",
        registryRouteId: "workspace-opportunities",
        icon: Target,
        workspaceRoute: true,
      },
      {
        id: "relationships",
        label: "Relationships",
        registryRouteId: "workspace-relationships",
        icon: Handshake,
        workspaceRoute: true,
      },
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
  {
    id: "advanced",
    label: AI_OS_ADVANCED_NAV_GROUP_LABEL,
    items: [
      { id: "ai-operations", label: "AI Operations", registryRouteId: "workspace-ai-operations", icon: Bot, workspaceRoute: true },
    ],
  },
]

/** GE-AIOS-UX-1A workspace-first operator sidebar manifest. */
export const GROWTH_WORKSPACE_FIRST_UX_1A_SHELL_NAV_MANIFEST: GrowthWorkspaceShellNavManifestGroup[] =
  GROWTH_WORKSPACE_FIRST_UX_1A_NAV_MANIFEST.map(toShellManifestGroup)

export function isGrowthWorkspaceFirstUx1aShellNavActive(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (typeof window !== "undefined") {
    return isGrowthWorkspaceFirstUx1aEnabledClient()
  }
  return isGrowthWorkspaceFirstUx1aEnabled(env)
}

export function resolveGrowthWorkspaceShellNavQaMarker(
  env: Record<string, string | undefined> = process.env,
): typeof GROWTH_WORKSPACE_SHELL_NAV_QA_MARKER | typeof GROWTH_WORKSPACE_SHELL_NAV_UX_1A_QA_MARKER {
  return isGrowthWorkspaceFirstUx1aShellNavActive(env)
    ? GROWTH_WORKSPACE_SHELL_NAV_UX_1A_QA_MARKER
    : GROWTH_WORKSPACE_SHELL_NAV_QA_MARKER
}

export function resolveGrowthWorkspaceShellNavManifest(
  env: Record<string, string | undefined> = process.env,
): GrowthWorkspaceShellNavManifestGroup[] {
  return isGrowthWorkspaceFirstUx1aShellNavActive(env)
    ? GROWTH_WORKSPACE_FIRST_UX_1A_SHELL_NAV_MANIFEST
    : GROWTH_WORKSPACE_SHELL_NAV_MANIFEST
}

/** Phase 5A operator sidebar ids — must match legacy manifest item ids exactly. */
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
  const manifest = resolveGrowthWorkspaceShellNavManifest()

  return manifest.map((group) => ({
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
  if (item.id === "workspace" || item.id === "dashboard") {
    return pathname === GROWTH_WORKSPACE_BASE_PATH
  }
  if (item.id === "review" || item.id === "approvals") {
    return (
      pathname === `${GROWTH_WORKSPACE_BASE_PATH}/review` ||
      pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/review/`) ||
      pathname === `${GROWTH_WORKSPACE_BASE_PATH}/os/approvals` ||
      pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/os/approvals/`)
    )
  }
  if (item.id === "pipeline" || item.id === "opportunities") {
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
  if (item.id === "ai-operations" && pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/os`)) {
    return true
  }
  if (item.id === "activity" && pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/activity`)) {
    return true
  }
  if (item.id === "engagement" && pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/engagement`)) {
    return true
  }
  if (item.id === "conversations" && pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/conversations`)) {
    return true
  }
  if (item.id === "relationships" && pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/relationships`)) {
    return true
  }
  if (item.id === "find-companies" || item.id === "audiences") {
    return pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/audiences`)
  }
  if (item.id === "about" || item.id === "about-ai") {
    return (
      pathname === `${GROWTH_WORKSPACE_BASE_PATH}/ava` ||
      pathname.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/ava/`)
    )
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

export function validateGrowthWorkspaceShellNavRegistryParity(
  manifest: GrowthWorkspaceShellNavManifestGroup[] = GROWTH_WORKSPACE_SHELL_NAV_MANIFEST,
): GrowthWorkspaceShellNavParityIssue[] {
  const issues: GrowthWorkspaceShellNavParityIssue[] = []

  for (const group of manifest) {
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
