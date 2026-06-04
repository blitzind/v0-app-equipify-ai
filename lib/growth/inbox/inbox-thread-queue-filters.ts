/** Client-safe inbox thread queue views (Phase 3A). */

import type { GrowthInboxThread } from "@/lib/growth/inbox/inbox-types"

export const GROWTH_INBOX_QUEUE_VIEWS = [
  "needs_action",
  "unassigned",
  "interested",
  "meeting_intent",
  "waiting",
  "archived",
  "all",
] as const

export type GrowthInboxQueueView = (typeof GROWTH_INBOX_QUEUE_VIEWS)[number]

export const GROWTH_INBOX_QUEUE_VIEW_LABELS: Record<GrowthInboxQueueView, string> = {
  needs_action: "Needs Action",
  unassigned: "Unassigned",
  interested: "Interested",
  meeting_intent: "Meeting Intent",
  waiting: "Waiting",
  archived: "Archived",
  all: "All",
}

export function filterInboxThreadsByQueueView(
  threads: GrowthInboxThread[],
  view: GrowthInboxQueueView,
): GrowthInboxThread[] {
  switch (view) {
    case "needs_action":
      return threads.filter(
        (thread) =>
          thread.thread_status !== "archived" &&
          (thread.requires_human_review ||
            thread.thread_status === "needs_review" ||
            thread.priority_tier === "critical" ||
            thread.priority_tier === "high"),
      )
    case "unassigned":
      return threads.filter((thread) => thread.thread_status !== "archived" && !thread.owner_user_id)
    case "interested":
      return threads.filter(
        (thread) =>
          thread.thread_status !== "archived" &&
          (thread.classification === "positive_interest" || thread.classification === "referral"),
      )
    case "meeting_intent":
      return threads.filter(
        (thread) => thread.thread_status !== "archived" && thread.classification === "meeting_intent",
      )
    case "waiting":
      return threads.filter((thread) => thread.thread_status === "waiting")
    case "archived":
      return threads.filter((thread) => thread.thread_status === "archived")
    case "all":
    default:
      return threads
  }
}

export function filterInboxThreadsBySearch(threads: GrowthInboxThread[], query: string): GrowthInboxThread[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return threads
  return threads.filter((thread) => {
    const haystack = [
      thread.subject,
      thread.lead_label,
      thread.owner_label ?? "",
      thread.classification,
      thread.thread_status,
    ]
      .join(" ")
      .toLowerCase()
    return haystack.includes(normalized)
  })
}

export function sortInboxQueueThreads(threads: GrowthInboxThread[]): GrowthInboxThread[] {
  const tierRank: Record<string, number> = { critical: 4, high: 3, normal: 2, low: 1 }
  return [...threads].sort((a, b) => {
    const tierDiff = (tierRank[b.priority_tier] ?? 0) - (tierRank[a.priority_tier] ?? 0)
    if (tierDiff !== 0) return tierDiff
    const scoreDiff = b.priority_score - a.priority_score
    if (scoreDiff !== 0) return scoreDiff
    const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
    const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
    return bTime - aTime
  })
}

export function countInboxThreadsByQueueView(
  threads: GrowthInboxThread[],
): Record<GrowthInboxQueueView, number> {
  return GROWTH_INBOX_QUEUE_VIEWS.reduce(
    (counts, view) => {
      counts[view] = filterInboxThreadsByQueueView(threads, view).length
      return counts
    },
    {} as Record<GrowthInboxQueueView, number>,
  )
}
