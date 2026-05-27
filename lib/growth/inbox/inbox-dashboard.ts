/** Inbox dashboard aggregation. Client-safe. */

import {
  GROWTH_UNIFIED_INBOX_FOUNDATION_QA_MARKER,
  type GrowthInboxDashboard,
  type GrowthInboxThread,
  type GrowthReplyIntelligenceSummary,
} from "@/lib/growth/inbox/inbox-types"

export function buildInboxDashboard(threads: GrowthInboxThread[]): GrowthInboxDashboard {
  const open_count = threads.filter((thread) => thread.thread_status === "open").length
  const needs_review_count = threads.filter((thread) => thread.thread_status === "needs_review").length
  const waiting_count = threads.filter((thread) => thread.thread_status === "waiting").length
  const critical_priority_count = threads.filter((thread) => thread.priority_tier === "critical").length

  const average_priority_score =
    threads.length > 0
      ? Math.round(threads.reduce((sum, thread) => sum + thread.priority_score, 0) / threads.length)
      : 0

  return {
    qa_marker: GROWTH_UNIFIED_INBOX_FOUNDATION_QA_MARKER,
    open_count,
    needs_review_count,
    waiting_count,
    critical_priority_count,
    average_priority_score,
  }
}

export function buildReplyIntelligenceSummary(threads: GrowthInboxThread[]): GrowthReplyIntelligenceSummary {
  return {
    budget: threads.filter((thread) => thread.classification === "budget").length,
    timeline: threads.filter((thread) => thread.classification === "timeline").length,
    meeting_intent: threads.filter((thread) => thread.classification === "meeting_intent").length,
    positive_interest: threads.filter((thread) => thread.classification === "positive_interest").length,
    competitor: threads.filter((thread) => thread.classification === "competitor").length,
    unsubscribe: threads.filter((thread) => thread.classification === "unsubscribe").length,
  }
}
