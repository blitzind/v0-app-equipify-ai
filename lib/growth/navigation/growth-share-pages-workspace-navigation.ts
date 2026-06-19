import { BarChart3, FileText, LayoutTemplate, PanelsTopLeft } from "lucide-react"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import { GROWTH_SHARE_PAGES_HUB_MANAGE_HREF } from "@/lib/growth/hubs/growth-workspace-hub-paths"

export const GROWTH_SHARE_PAGES_WORKSPACE_NAV_QA_MARKER = "growth-share-pages-workspace-nav-spux2-v1" as const

const BASE = `${GROWTH_WORKSPACE_BASE_PATH}/share-pages`

export type GrowthSharePagesWorkspaceTab = {
  id: "templates" | "manage" | "analytics" | "workspace"
  label: string
  href: string
  description: string
}

export const GROWTH_SHARE_PAGES_WORKSPACE_TABS: GrowthSharePagesWorkspaceTab[] = [
  {
    id: "templates",
    label: "Templates",
    href: `${BASE}/templates`,
    description: "Reusable share page templates.",
  },
  {
    id: "manage",
    label: "Manage",
    href: GROWTH_SHARE_PAGES_HUB_MANAGE_HREF,
    description: "Create and manage personalized share pages.",
  },
  {
    id: "analytics",
    label: "Analytics",
    href: `${GROWTH_WORKSPACE_BASE_PATH}/engagement`,
    description: "Engagement intelligence for share pages.",
  },
  {
    id: "workspace",
    label: "Workspace",
    href: `${BASE}/workspace`,
    description: "Operator review workspace for share pages.",
  },
]

export function resolveGrowthSharePagesActiveTabId(pathname: string): GrowthSharePagesWorkspaceTab["id"] | null {
  const normalized = pathname.replace(/\/+$/, "")
  if (normalized.endsWith("/share-pages/workspace")) return "workspace"
  if (normalized.includes("/share-pages/templates")) return "templates"
  if (normalized.includes("/share-pages/manage")) return "manage"
  if (normalized.endsWith("/engagement")) return "analytics"
  return null
}

export const GROWTH_SHARE_PAGES_WORKSPACE_TAB_ICONS = {
  templates: LayoutTemplate,
  manage: FileText,
  analytics: BarChart3,
  workspace: PanelsTopLeft,
} as const
