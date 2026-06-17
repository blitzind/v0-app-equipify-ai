/** Client-safe inbox overview metrics (Phase 7I). */

import type { GrowthInboxThread } from "@/lib/growth/inbox/inbox-types"
import {
  countInboxThreadsByQueueView,
  filterInboxThreadsByQueueView,
} from "@/lib/growth/inbox/inbox-thread-queue-filters"
import type { GrowthSalesExecutionDashboard } from "@/lib/growth/reply-intelligence/reply-intent-types"

export const GROWTH_INBOX_OVERVIEW_METRICS_QA_MARKER = "growth-inbox-overview-metrics-v3" as const

export type GrowthInboxOverviewMetrics = {
  qaMarker: typeof GROWTH_INBOX_OVERVIEW_METRICS_QA_MARKER
  needsAction: number
  interested: number
  meetingIntent: number
  objections: number
  highPriority: number
  workflowTasks: number
  unreadConversations: number
  /** Reply intelligence dashboard — same source as Admin Reply Inbox header stats. */
  needsReview: number
  objectionHeavy: number
  meetingRequests: number
}

export function countUnreadInboxConversations(threads: GrowthInboxThread[]): number {
  return threads.filter(
    (thread) =>
      thread.thread_status !== "archived" &&
      (thread.thread_status === "needs_review" || thread.requires_human_review),
  ).length
}

export function deriveGrowthInboxOverviewMetrics(input: {
  threads: GrowthInboxThread[]
  replyDashboard: GrowthSalesExecutionDashboard | null
}): GrowthInboxOverviewMetrics {
  const queueCounts = countInboxThreadsByQueueView(input.threads)

  return {
    qaMarker: GROWTH_INBOX_OVERVIEW_METRICS_QA_MARKER,
    needsAction: queueCounts.needs_action,
    interested: queueCounts.interested,
    meetingIntent: queueCounts.meeting_intent,
    objections: queueCounts.objections,
    highPriority: queueCounts.high_priority,
    workflowTasks: input.replyDashboard?.workflowTaskCount ?? 0,
    unreadConversations: countUnreadInboxConversations(input.threads),
    needsReview: input.replyDashboard?.needsReviewCount ?? 0,
    objectionHeavy: input.replyDashboard?.objectionHeavyCount ?? 0,
    meetingRequests: input.replyDashboard?.meetingRequestCount ?? 0,
  }
}

/** Expose queue counts for tests without duplicating filter logic. */
export function snapshotInboxQueueCounts(threads: GrowthInboxThread[]) {
  return countInboxThreadsByQueueView(threads)
}

export function countInboxThreadsForOverviewMetric(
  threads: GrowthInboxThread[],
  metric: keyof Pick<
    GrowthInboxOverviewMetrics,
    "needsAction" | "interested" | "meetingIntent" | "objections" | "highPriority"
  >,
): number {
  const viewMap = {
    needsAction: "needs_action",
    interested: "interested",
    meetingIntent: "meeting_intent",
    objections: "objections",
    highPriority: "high_priority",
  } as const
  return filterInboxThreadsByQueueView(threads, viewMap[metric]).length
}
