/** Growth workspace operator home dashboard (Phase 6A) — client-safe types. */

export const GROWTH_WORKSPACE_DASHBOARD_QA_MARKER = "growth-workspace-dashboard-v1" as const

export type GrowthWorkspaceDashboardMetricLink = {
  label: string
  value: number
  href: string
  emptyHint?: string
}

export type GrowthWorkspaceDashboardSection = {
  id:
    | "my-queue"
    | "activity"
    | "pipeline-snapshot"
    | "campaign-snapshot"
    | "intelligence"
    | "quick-actions"
  title: string
  metrics: GrowthWorkspaceDashboardMetricLink[]
  emptyMessage?: string
}

export type GrowthWorkspaceDashboardQuickAction = {
  id: string
  label: string
  href: string
}

export type GrowthWorkspaceDashboardViewModel = {
  qaMarker: typeof GROWTH_WORKSPACE_DASHBOARD_QA_MARKER
  generatedAt: string
  sections: GrowthWorkspaceDashboardSection[]
  quickActions: GrowthWorkspaceDashboardQuickAction[]
  operatorName?: string | null
  recommendedAction?: string | null
}
