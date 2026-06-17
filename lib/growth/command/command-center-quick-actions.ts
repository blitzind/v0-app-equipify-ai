/** Growth Command Center quick action rail (daily workspace v4). */

import type { LucideIcon } from "lucide-react"
import { GitBranch, Mail, Search, Sparkles, Target, Video } from "lucide-react"
import { GROWTH_WORKSPACE_CANONICAL_ALIASES } from "@/lib/growth/navigation/growth-workspace-cleanup-audit"

export const GROWTH_COMMAND_CENTER_ACTIONS_QA_MARKER =
  "growth-command-center-actions-v4" as const

export type GrowthCommandCenterQuickAction = {
  href: string
  label: string
  icon: LucideIcon
}

export const GROWTH_COMMAND_CENTER_QUICK_ACTIONS: readonly GrowthCommandCenterQuickAction[] = [
  { href: "/admin/growth/search", label: "Prospect Search", icon: Search },
  { href: GROWTH_WORKSPACE_CANONICAL_ALIASES.inbox, label: "Inbox", icon: Mail },
  { href: "/admin/growth/meetings", label: "Meetings", icon: Video },
  { href: GROWTH_WORKSPACE_CANONICAL_ALIASES.pipeline, label: "Opportunities", icon: Target },
  { href: "/admin/growth/sequences", label: "Launch Campaign", icon: GitBranch },
  { href: "/admin/growth/aiden", label: "Open Aiden", icon: Sparkles },
] as const
