/**
 * GE-AVA-FRESH-SLATE-1H — Gate Growth Home customer/account cards on live runtime activity.
 */

import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"
import {
  AI_TEAMMATE_DEFAULT_NAME,
  resolveAiTeammatePresentation,
  type AiTeammatePresentation,
} from "@/lib/workspace/ai-teammate-identity"

export const GROWTH_HOME_FRESH_SLATE_RUNTIME_ACTIVITY_QA_MARKER =
  "growth-home-fresh-slate-runtime-activity-1h-v1" as const

/** Demo / CS placeholder accounts — never render without live Growth runtime signals. */
export const GROWTH_HOME_DEMO_CUSTOMER_ACCOUNT_NAMES = [
  "Acme Manufacturing",
  "King of Boat Care",
] as const

export function growthHomeFreshTeammateHeadline(teammate: AiTeammatePresentation): string {
  return `${teammate.name} is standing by`
}
export const GROWTH_HOME_FRESH_AVA_HEADLINE =
  growthHomeFreshTeammateHeadline(resolveAiTeammatePresentation(AI_TEAMMATE_DEFAULT_NAME))
export const GROWTH_HOME_FRESH_AVA_SUBLINE =
  "Import prospects or start a mission to begin." as const

function metricValue(dashboard: GrowthWorkspaceDashboardViewModel, sectionId: string, label: string): number {
  const section = dashboard.sections.find((row) => row.id === sectionId)
  return section?.metrics.find((metric) => metric.label === label)?.value ?? 0
}

function sumSectionMetrics(dashboard: GrowthWorkspaceDashboardViewModel, sectionId: string): number {
  const section = dashboard.sections.find((row) => row.id === sectionId)
  return (section?.metrics ?? []).reduce((sum, metric) => sum + (metric.value ?? 0), 0)
}

export function isGrowthHomeDemoCustomerAccountName(name: string): boolean {
  const normalized = name.trim().toLowerCase()
  if (!normalized) return false
  return GROWTH_HOME_DEMO_CUSTOMER_ACCOUNT_NAMES.some((demo) => normalized.includes(demo.toLowerCase()))
}

export function hasLiveGrowthHomeRuntimeActivity(dashboard: GrowthWorkspaceDashboardViewModel): boolean {
  const briefing = dashboard.briefing

  const queueSignals =
    metricValue(dashboard, "my-queue", "Leads needing action") +
    metricValue(dashboard, "my-queue", "Call-ready leads") +
    metricValue(dashboard, "my-queue", "Inbox requiring replies") +
    metricValue(dashboard, "my-queue", "Opportunities needing follow-up")

  const activitySignals =
    metricValue(dashboard, "activity", "Emails sent today") +
    metricValue(dashboard, "activity", "Replies today") +
    metricValue(dashboard, "activity", "Calls today") +
    metricValue(dashboard, "activity", "Meetings today")

  const pipelineSignals =
    metricValue(dashboard, "pipeline-snapshot", "Open opportunities") +
    metricValue(dashboard, "pipeline-snapshot", "Close candidates")

  const campaignSignals =
    metricValue(dashboard, "campaign-snapshot", "Active campaigns") +
    metricValue(dashboard, "campaign-snapshot", "Enrollments") +
    metricValue(dashboard, "campaign-snapshot", "Executions today") +
    metricValue(dashboard, "campaign-snapshot", "Approval queue")

  const intelligenceSignals =
    metricValue(dashboard, "intelligence", "Hot companies") +
    metricValue(dashboard, "intelligence", "Relationship alerts") +
    metricValue(dashboard, "intelligence", "Conversation alerts")

  const briefingSignals =
    (briefing?.summary.pending_approvals ?? 0) +
    (briefing?.summary.replies_needing_attention ?? 0) +
    (briefing?.summary.blocked_jobs ?? 0) +
    (briefing?.approval_queue.running_jobs ?? 0) +
    (briefing?.meetings.opportunities_pending ?? 0) +
    (briefing?.revenue.emails_sent ?? 0) +
    (briefing?.revenue.replies ?? 0) +
    (briefing?.revenue.opportunities ?? 0)

  const workQueueSignals =
    (dashboard.dailyRevenueWorkQueueDisplay?.actionable_count ?? 0) +
    (dashboard.dailyRevenueWorkQueueDisplay?.total_accounts ?? 0) +
    (dashboard.dailyRevenueWorkQueue?.critical.length ?? 0) +
    (dashboard.dailyRevenueWorkQueue?.high.length ?? 0)

  const leadInboxSignals = dashboard.leadInboxHighlights.length

  return (
    queueSignals +
      activitySignals +
      pipelineSignals +
      campaignSignals +
      intelligenceSignals +
      briefingSignals +
      workQueueSignals +
      leadInboxSignals >
    0
  )
}

export function deriveLiveGrowthHomeCustomerAccountNames(
  dashboard: GrowthWorkspaceDashboardViewModel,
): string[] {
  const names = new Set<string>()

  for (const highlight of dashboard.leadInboxHighlights) {
    const company = highlight.companyName.trim()
    if (company && !isGrowthHomeDemoCustomerAccountName(company)) {
      names.add(company)
    }
  }

  for (const item of dashboard.dailyRevenueWorkQueueDisplay?.top_items ?? []) {
    const company = item.company_name.trim()
    if (company && !isGrowthHomeDemoCustomerAccountName(company)) {
      names.add(company)
    }
  }

  for (const priority of dashboard.briefing?.priorities ?? []) {
    const inferred = inferLiveCustomerNameFromText(priority.title)
    if (inferred) names.add(inferred)
  }

  return [...names]
}

export function inferLiveCustomerNameFromText(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const lower = trimmed.toLowerCase()
  if (lower.includes("acme") || lower.includes("boat") || lower.includes("king of boat")) {
    return null
  }

  if (lower.includes("biomedical") || lower.includes("precision")) {
    return "Precision Biomedical"
  }

  if (isGrowthHomeDemoCustomerAccountName(trimmed)) {
    return null
  }

  return trimmed.length > 48 ? `${trimmed.slice(0, 45).trim()}…` : trimmed
}

export function collectGrowthHomeRenderedCustomerNames(input: {
  customerSuccessMissions: Array<{ customer: string }>
  customerHealth: Array<{ summary: string }>
  renewalsMonitoring: Array<{ customer: string }>
  customerWins: Array<{ headline: string; detail: string }>
  serviceMissions?: Array<{ customer: string }>
}): string[] {
  const names: string[] = []
  for (const mission of input.customerSuccessMissions) names.push(mission.customer)
  for (const item of input.customerHealth) names.push(item.summary)
  for (const item of input.renewalsMonitoring) names.push(item.customer)
  for (const win of input.customerWins) {
    names.push(win.headline)
    names.push(win.detail)
  }
  for (const mission of input.serviceMissions ?? []) names.push(mission.customer)
  return names
}

export function containsGrowthHomeDemoCustomerAccount(content: string): boolean {
  const lower = content.toLowerCase()
  return GROWTH_HOME_DEMO_CUSTOMER_ACCOUNT_NAMES.some((demo) => lower.includes(demo.toLowerCase()))
}

/** True when every operational metric bucket is zero — post-reset fresh slate. */
export function isGrowthHomeFreshSlateDashboard(dashboard: GrowthWorkspaceDashboardViewModel): boolean {
  return !hasLiveGrowthHomeRuntimeActivity(dashboard)
}

export function sumAllGrowthHomeOperationalMetrics(dashboard: GrowthWorkspaceDashboardViewModel): number {
  return (
    sumSectionMetrics(dashboard, "my-queue") +
    sumSectionMetrics(dashboard, "activity") +
    sumSectionMetrics(dashboard, "pipeline-snapshot") +
    sumSectionMetrics(dashboard, "campaign-snapshot") +
    sumSectionMetrics(dashboard, "intelligence")
  )
}
