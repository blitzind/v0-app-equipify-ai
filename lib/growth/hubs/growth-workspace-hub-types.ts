import type { LucideIcon } from "lucide-react"

export const GROWTH_WORKSPACE_HUB_QA_MARKER = "growth-workspace-hub-v1" as const

/** Default overview metric copy when live counts are not wired yet. */
export const GROWTH_WORKSPACE_HUB_METRIC_EMPTY_DEFAULT = "No activity yet" as const

export type GrowthWorkspaceHubOverviewMetric = {
  id: string
  label: string
  hint: string
  /** Customer-safe placeholder when the metric has no live count yet. */
  emptyValue?: string
}

export type GrowthWorkspaceHubQuickAction = {
  id: string
  label: string
  description: string
  href: string
  icon: LucideIcon
  variant?: "default" | "outline"
}

export type GrowthWorkspaceHubDrilldown = {
  id: string
  label: string
  description: string
  href: string
}

export type GrowthWorkspaceHubSection = {
  id: string
  title: string
  description: string
  drilldowns?: GrowthWorkspaceHubDrilldown[]
  emptyHint?: string
}

export type GrowthWorkspaceHubManifest = {
  id: string
  title: string
  description: string
  icon: LucideIcon
  iconClassName: string
  overview: GrowthWorkspaceHubOverviewMetric[]
  quickActions: GrowthWorkspaceHubQuickAction[]
  sections: GrowthWorkspaceHubSection[]
}
