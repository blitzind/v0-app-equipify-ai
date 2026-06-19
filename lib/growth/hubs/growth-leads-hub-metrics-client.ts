/** Leads operator home metrics — existing platform APIs only (UX-AUDIT-4). Client-safe. */

import type { GrowthLeadInboxDashboardSectionPayload } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import type { GrowthMeeting } from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"

export const GROWTH_LEADS_HUB_METRICS_QA_MARKER = "growth-leads-hub-metrics-v3" as const

export type GrowthLeadsHubMetricsSnapshot = {
  queueDepth: number | null
  capturedToday: number | null
  readyToCall: number | null
  researchRuns: number | null
  accountsAwaitingResearch: number | null
  needFollowUp: number | null
  leadsAwaitingResearch: number | null
  meetingsScheduled: number | null
  followUpsOverdue: number | null
  nextReadyCallLabel: string | null
  highPriorityCount: number | null
  needsReviewCount: number | null
  enrichmentNeededCount: number | null
}

function sectionCount(sections: GrowthLeadInboxDashboardSectionPayload[], id: string): number {
  return sections.find((section) => section.id === id)?.items.length ?? 0
}

function countScheduledMeetings(items: GrowthMeeting[]): number {
  const now = Date.now()
  return items.filter((item) => {
    if (item.status !== "scheduled" && item.status !== "proposed") return false
    if (!item.startAt) return item.status === "scheduled"
    return new Date(item.startAt).getTime() >= now
  }).length
}

export async function fetchGrowthLeadsHubMetrics(signal?: AbortSignal): Promise<GrowthLeadsHubMetricsSnapshot> {
  const [inboxResult, queueResult, meetingsResult] = await Promise.allSettled([
    fetch("/api/platform/growth/lead-inbox?sort=priority", { cache: "no-store", signal }),
    fetch("/api/platform/growth/calls/queue", { cache: "no-store", signal }),
    fetch("/api/platform/growth/meetings/inbox?limit=50", { cache: "no-store", signal }),
  ])

  let queueDepth: number | null = null
  let capturedToday: number | null = null
  let researchRuns: number | null = null
  let accountsAwaitingResearch: number | null = null
  let needFollowUp: number | null = null
  let followUpsOverdue: number | null = null
  let highPriorityCount: number | null = null
  let needsReviewCount: number | null = null
  let enrichmentNeededCount: number | null = null

  if (inboxResult.status === "fulfilled") {
    const data = (await inboxResult.value.json().catch(() => ({}))) as {
      ok?: boolean
      total?: number
      sections?: GrowthLeadInboxDashboardSectionPayload[]
    }
    if (inboxResult.value.ok && data.ok !== false) {
      const sections = data.sections ?? []
      queueDepth = typeof data.total === "number" ? data.total : null
      researchRuns = sectionCount(sections, "pipeline_running")
      accountsAwaitingResearch =
        sectionCount(sections, "needs_review") + sectionCount(sections, "enrichment_needed")
      needFollowUp = sectionCount(sections, "high_priority") + sectionCount(sections, "needs_review")
      followUpsOverdue = sectionCount(sections, "high_priority")
      highPriorityCount = sectionCount(sections, "high_priority")
      needsReviewCount = sectionCount(sections, "needs_review")
      enrichmentNeededCount = sectionCount(sections, "enrichment_needed")
    }
  }

  let readyToCall: number | null = null
  let nextReadyCallLabel: string | null = null
  if (queueResult.status === "fulfilled") {
    const data = (await queueResult.value.json().catch(() => ({}))) as {
      ok?: boolean
      queue?: Array<{ contactName?: string | null; companyName?: string | null }>
    }
    if (queueResult.value.ok && data.ok !== false && Array.isArray(data.queue)) {
      readyToCall = data.queue.length
      const first = data.queue[0]
      nextReadyCallLabel = first?.contactName?.trim() || first?.companyName?.trim() || null
    }
  }

  let meetingsScheduled: number | null = null
  if (meetingsResult.status === "fulfilled") {
    const data = (await meetingsResult.value.json().catch(() => ({}))) as {
      ok?: boolean
      feed?: { items?: GrowthMeeting[] }
    }
    if (meetingsResult.value.ok && data.ok !== false) {
      meetingsScheduled = countScheduledMeetings(data.feed?.items ?? [])
    }
  }

  return {
    queueDepth,
    capturedToday,
    readyToCall,
    researchRuns,
    accountsAwaitingResearch,
    needFollowUp,
    leadsAwaitingResearch: accountsAwaitingResearch,
    meetingsScheduled,
    followUpsOverdue,
    nextReadyCallLabel,
    highPriorityCount,
    needsReviewCount,
    enrichmentNeededCount,
  }
}

export { resolveGrowthLeadsContinueWorkingHref } from "@/lib/growth/hubs/growth-leads-hub-briefing-utils"
