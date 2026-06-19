/** Client-safe inbox thread queue views (Phase 3A + 7K call convergence). */

import type { GrowthInboxThread } from "@/lib/growth/inbox/inbox-types"
import {
  GROWTH_INBOX_CALL_QUEUE_VIEWS,
  GROWTH_INBOX_CALL_QUEUE_VIEW_LABELS,
  isGrowthInboxCallQueueView,
  type GrowthInboxCallQueueView,
} from "@/lib/growth/inbox/inbox-call-communication-read-model"
import {
  type GrowthInboxChannelFilter,
  GROWTH_INBOX_CHANNEL_FILTER_OPTIONS,
  filterInboxThreadsByChannel,
} from "@/lib/growth/inbox/inbox-channel-types"

export const GROWTH_INBOX_THREAD_QUEUE_VIEWS = [
  "all",
  "needs_action",
  "interested",
  "meeting_intent",
  "unread",
  "objections",
  "high_priority",
  "unassigned",
  "waiting",
  "archived",
] as const

export type GrowthInboxThreadQueueView = (typeof GROWTH_INBOX_THREAD_QUEUE_VIEWS)[number]

/** Primary operator filters — notification states as queue views (UX-AUDIT-9). */
export const GROWTH_INBOX_PRIMARY_QUEUE_VIEWS = [
  "needs_action",
  "interested",
  "meeting_intent",
  "unread",
] as const satisfies readonly GrowthInboxThreadQueueView[]

/** Secondary filters moved into More Filters drawer. */
export const GROWTH_INBOX_SECONDARY_QUEUE_VIEWS = [
  "all",
  "high_priority",
  "objections",
  "unassigned",
  "waiting",
  "archived",
] as const satisfies readonly GrowthInboxThreadQueueView[]

export const GROWTH_INBOX_QUEUE_VIEWS = [
  ...GROWTH_INBOX_THREAD_QUEUE_VIEWS,
  ...GROWTH_INBOX_CALL_QUEUE_VIEWS,
] as const

export type GrowthInboxQueueView = (typeof GROWTH_INBOX_QUEUE_VIEWS)[number]

export const GROWTH_INBOX_QUEUE_VIEW_LABELS: Record<GrowthInboxQueueView, string> = {
  all: "All",
  needs_action: "Needs Action",
  interested: "Interested",
  meeting_intent: "Meetings",
  unread: "Unread",
  objections: "Objections",
  high_priority: "High Priority",
  unassigned: "Unassigned",
  waiting: "Waiting",
  archived: "Archived",
  ...GROWTH_INBOX_CALL_QUEUE_VIEW_LABELS,
}

export { isGrowthInboxCallQueueView, type GrowthInboxCallQueueView }

const INBOX_OBJECTION_CLASSIFICATIONS = new Set<GrowthInboxThread["classification"]>([
  "budget",
  "timeline",
  "competitor",
  "not_interested",
])

function isInboxThreadObjection(thread: GrowthInboxThread): boolean {
  return INBOX_OBJECTION_CLASSIFICATIONS.has(thread.classification)
}

function isInboxThreadHighPriority(thread: GrowthInboxThread): boolean {
  return thread.priority_tier === "critical" || thread.priority_tier === "high"
}

function isInboxThreadUnread(thread: GrowthInboxThread): boolean {
  return (
    thread.thread_status !== "archived" &&
    (thread.thread_status === "needs_review" || thread.requires_human_review)
  )
}


export function filterInboxThreadsByQueueView(
  threads: GrowthInboxThread[],
  view: GrowthInboxQueueView,
): GrowthInboxThread[] {
  if (isGrowthInboxCallQueueView(view)) return []
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
    case "unread":
      return threads.filter(isInboxThreadUnread)
    case "objections":
      return threads.filter(
        (thread) => thread.thread_status !== "archived" && isInboxThreadObjection(thread),
      )
    case "high_priority":
      return threads.filter(
        (thread) => thread.thread_status !== "archived" && isInboxThreadHighPriority(thread),
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
      thread.channel,
      thread.provider_family,
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
