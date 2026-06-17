/** Workspace operator home quick actions — always under `/growth/*`. */

import type { LucideIcon } from "lucide-react"
import { GitBranch, Inbox, Phone, Search, Share2, UserPlus } from "lucide-react"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import type { GrowthWorkspaceDashboardQuickAction } from "@/lib/growth/workspace/growth-workspace-dashboard-types"

export type GrowthWorkspaceDashboardQuickActionDef = GrowthWorkspaceDashboardQuickAction & {
  icon: LucideIcon
}

export const GROWTH_WORKSPACE_DASHBOARD_QUICK_ACTIONS: readonly GrowthWorkspaceDashboardQuickActionDef[] = [
  { id: "add-lead", label: "Add lead", href: `${GROWTH_WORKSPACE_BASE_PATH}/leads`, icon: UserPlus },
  {
    id: "search-prospects",
    label: "Search prospects",
    href: `${GROWTH_WORKSPACE_BASE_PATH}/leads/lead-engine`,
    icon: Search,
  },
  { id: "open-inbox", label: "Open inbox", href: `${GROWTH_WORKSPACE_BASE_PATH}/inbox`, icon: Inbox },
  { id: "open-calls", label: "Open calls", href: `${GROWTH_WORKSPACE_BASE_PATH}/calls`, icon: Phone },
  { id: "create-campaign", label: "Create campaign", href: `${GROWTH_WORKSPACE_BASE_PATH}/campaigns`, icon: GitBranch },
  {
    id: "create-share-page",
    label: "Create share page",
    href: `${GROWTH_WORKSPACE_BASE_PATH}/share-pages`,
    icon: Share2,
  },
] as const
