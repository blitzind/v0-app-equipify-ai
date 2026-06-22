/** Workspace operator home quick actions — always under `/growth/*`. */

import type { LucideIcon } from "lucide-react"
import { GitBranch, Inbox, Phone, Rocket, Search, UserPlus } from "lucide-react"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import type { GrowthWorkspaceDashboardQuickAction } from "@/lib/growth/workspace/growth-workspace-dashboard-types"

export type GrowthWorkspaceDashboardQuickActionDef = GrowthWorkspaceDashboardQuickAction & {
  icon: LucideIcon
}

export const GROWTH_WORKSPACE_DASHBOARD_QUICK_ACTIONS: readonly GrowthWorkspaceDashboardQuickActionDef[] = [
  {
    id: "add-lead",
    label: "Add lead",
    description: "Jump to leads to capture or qualify a new prospect.",
    shortcut: "1",
    href: `${GROWTH_WORKSPACE_BASE_PATH}/leads`,
    icon: UserPlus,
  },
  {
    id: "search-prospects",
    label: "Search prospects",
    description: "Open Lead Engine to research and source new accounts.",
    shortcut: "2",
    href: `${GROWTH_WORKSPACE_BASE_PATH}/leads/lead-engine`,
    icon: Search,
  },
  {
    id: "open-inbox",
    label: "Open inbox",
    description: "Review threads that need a human reply.",
    shortcut: "3",
    href: `${GROWTH_WORKSPACE_BASE_PATH}/inbox`,
    icon: Inbox,
  },
  {
    id: "open-calls",
    label: "Open calls",
    description: "Start or resume outbound calling work.",
    shortcut: "4",
    href: `${GROWTH_WORKSPACE_BASE_PATH}/calls`,
    icon: Phone,
  },
  {
    id: "create-campaign",
    label: "Create campaign",
    description: "Manage sequence templates and enrollments.",
    shortcut: "5",
    href: `${GROWTH_WORKSPACE_BASE_PATH}/campaigns`,
    icon: GitBranch,
  },
  {
    id: "launch-personalized-video",
    label: "Launch personalized video",
    description: "Run the campaign launch wizard for a personalized video sequence.",
    shortcut: "6",
    href: `${GROWTH_WORKSPACE_BASE_PATH}/videos/personalized/launch`,
    icon: Rocket,
  },
] as const

export const GROWTH_WORKSPACE_DASHBOARD_QUICK_ACTION_QA_MARKER = "growth-workspace-dashboard-quick-actions-v2" as const
