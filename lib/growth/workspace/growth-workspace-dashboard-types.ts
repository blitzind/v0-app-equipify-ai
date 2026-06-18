/** Growth workspace operator home dashboard (Phase 6A) — client-safe types. */

import type { AidenDailyBriefing } from "@/lib/growth/aiden/aiden-daily-briefing"

export const GROWTH_WORKSPACE_DASHBOARD_QA_MARKER = "growth-workspace-dashboard-v2" as const

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
  description?: string
  shortcut?: string
}

export type GrowthWorkspaceDashboardWelcome = {
  greeting: string
  operatorName: string | null
  recommendedAction: string | null
  todaysFocus: string | null
}

export type GrowthWorkspaceDashboardViewModel = {
  qaMarker: typeof GROWTH_WORKSPACE_DASHBOARD_QA_MARKER
  generatedAt: string
  sections: GrowthWorkspaceDashboardSection[]
  quickActions: GrowthWorkspaceDashboardQuickAction[]
  welcome: GrowthWorkspaceDashboardWelcome
  /** Aiden briefing already loaded in dashboard batch — reused for operator home parity. */
  briefing: AidenDailyBriefing | null
  operatorName?: string | null
  recommendedAction?: string | null
}
