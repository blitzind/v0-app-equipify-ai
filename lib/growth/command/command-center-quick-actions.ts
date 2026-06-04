/** Growth Command Center quick action rail (strategy-aligned v3). */

import { GROWTH_CALLS_PRIMARY_HREF } from "@/lib/growth/navigation/growth-workspace-consolidation"
import type { LucideIcon } from "lucide-react"
import {
  CheckCircle2,
  GitBranch,
  Headphones,
  Radar,
  Search,
  Sparkles,
  Video,
} from "lucide-react"

export const GROWTH_COMMAND_CENTER_ACTIONS_QA_MARKER =
  "growth-command-center-actions-v3" as const

export type GrowthCommandCenterQuickAction = {
  href: string
  label: string
  icon: LucideIcon
}

export const GROWTH_COMMAND_CENTER_QUICK_ACTIONS: readonly GrowthCommandCenterQuickAction[] = [
  { href: "/admin/growth/search", label: "Prospect Search", icon: Search },
  { href: "/admin/growth/intent-pixel", label: "View Intent Activity", icon: Radar },
  { href: "/admin/growth/leads?focus=research", label: "Run Research", icon: Sparkles },
  { href: "/admin/growth/leads?focus=ai-copilot", label: "Generate Copilot Draft", icon: Sparkles },
  { href: GROWTH_CALLS_PRIMARY_HREF, label: "Open Calls", icon: Headphones },
  { href: "/admin/growth/meetings", label: "Join Meeting", icon: Video },
  { href: "/admin/growth/sequences", label: "Launch Sequence", icon: GitBranch },
  { href: "/admin/growth/sequences/execution", label: "Open Sequence Approvals", icon: CheckCircle2 },
] as const
