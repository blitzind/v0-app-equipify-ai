/** Growth workspace operator home dashboard (Phase 6A) — client-safe types. */

import type { AidenDailyBriefing } from "@/lib/growth/aiden/aiden-daily-briefing"
import type { DailyRevenueWorkQueue } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-types"
import type { DailyRevenueWorkQueueDisplaySummary } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-view"

export const GROWTH_WORKSPACE_DASHBOARD_QA_MARKER = "growth-workspace-dashboard-v4" as const

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

export type GrowthWorkspaceDashboardActionCard = {
  id: string
  title: string
  description: string
  href: string
}

export type GrowthWorkspaceDashboardLeadInboxHighlight = {
  id: string
  companyName: string
  actionLabel: string
  priority: "critical" | "high" | "medium" | "low"
  href: string
  confidence: number | null
}

export type GrowthWorkspaceDashboardViewModel = {
  qaMarker: typeof GROWTH_WORKSPACE_DASHBOARD_QA_MARKER
  generatedAt: string
  sections: GrowthWorkspaceDashboardSection[]
  quickActions: GrowthWorkspaceDashboardQuickAction[]
  operatorActionCards: GrowthWorkspaceDashboardActionCard[]
  welcome: GrowthWorkspaceDashboardWelcome
  /** @deprecated GE-AIOS-17E — legacy Aiden briefing; Home loads workspace-summary with briefing: null. */
  briefing: AidenDailyBriefing | null
  operatorName?: string | null
  recommendedAction?: string | null
  /** Top lead-inbox rows from the existing batched fetch — presentation only. */
  leadInboxHighlights: GrowthWorkspaceDashboardLeadInboxHighlight[]
  /** GE-AIOS-UX-1B — canonical daily revenue work queue from batched fetch. */
  dailyRevenueWorkQueueEnabled: boolean
  dailyRevenueWorkQueue: DailyRevenueWorkQueue | null
  dailyRevenueWorkQueueDisplay: DailyRevenueWorkQueueDisplaySummary | null
}
