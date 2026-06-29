/**
 * GE-AIOS-SDR-2B — Daily Revenue Work Queue runtime integration (client-safe).
 * Single source of truth for ordering across consumers — no duplicate prioritization.
 */

import type {
  DailyRevenueWorkQueue,
  WorkQueueDisposition,
  WorkQueueItem,
} from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-types"

export const GROWTH_DAILY_REVENUE_WORK_QUEUE_INTEGRATION_QA_MARKER =
  "daily-revenue-work-queue-integration-v1" as const

export type DailyRevenueWorkQueueIndexEntry = {
  item: WorkQueueItem
  queuePosition: number
  totalActionable: number
}

export type LeadDailyWorkQueueStatus = {
  qa_marker: typeof GROWTH_DAILY_REVENUE_WORK_QUEUE_INTEGRATION_QA_MARKER
  lead_id: string
  in_queue: boolean
  queue_position: number | null
  total_actionable: number
  priority: WorkQueueDisposition | null
  action_label: string | null
  channel_label: string | null
  reasoning: string[]
  requires_human_approval: boolean
}

const ACTION_LABELS: Record<WorkQueueItem["action"], string> = {
  send_email: "Send email",
  place_call: "Place call",
  launch_voice_drop: "Launch voice drop",
  send_sms: "Send SMS",
  create_linkedin_task: "LinkedIn task",
  send_video: "Send video",
  schedule_meeting: "Schedule meeting",
  wait: "Wait",
  stop: "Stop",
  request_human_review: "Human review",
}

const CHANNEL_LABELS: Record<WorkQueueItem["recommendedChannel"], string> = {
  email: "Email",
  phone: "Phone",
  sms: "SMS",
  voice_drop: "Voice drop",
  linkedin: "LinkedIn",
  video: "Video",
  wait: "Wait",
  stop: "Stop",
  human: "Human",
}

const DISPOSITION_RANK: Record<WorkQueueDisposition, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  waiting: 1,
  blocked: 0,
  completed: -1,
}

export function flattenDailyRevenueWorkQueueItems(queue: DailyRevenueWorkQueue): WorkQueueItem[] {
  return [
    ...queue.critical,
    ...queue.high,
    ...queue.medium,
    ...queue.low,
    ...queue.waiting,
    ...queue.blocked,
    ...queue.completed,
  ]
}

export function flattenActionableDailyRevenueWorkQueueItems(queue: DailyRevenueWorkQueue): WorkQueueItem[] {
  return [...queue.critical, ...queue.high, ...queue.medium, ...queue.low]
}

export function buildDailyRevenueWorkQueueIndex(
  queue: DailyRevenueWorkQueue,
): Map<string, DailyRevenueWorkQueueIndexEntry> {
  const actionable = flattenActionableDailyRevenueWorkQueueItems(queue)
  const index = new Map<string, DailyRevenueWorkQueueIndexEntry>()
  actionable.forEach((item, offset) => {
    index.set(item.leadId, {
      item,
      queuePosition: offset + 1,
      totalActionable: actionable.length,
    })
  })
  return index
}

export function resolveLeadDailyWorkQueueStatus(
  queue: DailyRevenueWorkQueue | null | undefined,
  leadId: string,
): LeadDailyWorkQueueStatus {
  if (!queue) {
    return {
      qa_marker: GROWTH_DAILY_REVENUE_WORK_QUEUE_INTEGRATION_QA_MARKER,
      lead_id: leadId,
      in_queue: false,
      queue_position: null,
      total_actionable: 0,
      priority: null,
      action_label: null,
      channel_label: null,
      reasoning: [],
      requires_human_approval: false,
    }
  }

  const allItems = flattenDailyRevenueWorkQueueItems(queue)
  const item = allItems.find((entry) => entry.leadId === leadId)
  const index = buildDailyRevenueWorkQueueIndex(queue).get(leadId)

  if (!item) {
    return {
      qa_marker: GROWTH_DAILY_REVENUE_WORK_QUEUE_INTEGRATION_QA_MARKER,
      lead_id: leadId,
      in_queue: false,
      queue_position: null,
      total_actionable: flattenActionableDailyRevenueWorkQueueItems(queue).length,
      priority: null,
      action_label: null,
      channel_label: null,
      reasoning: [],
      requires_human_approval: false,
    }
  }

  return {
    qa_marker: GROWTH_DAILY_REVENUE_WORK_QUEUE_INTEGRATION_QA_MARKER,
    lead_id: leadId,
    in_queue: true,
    queue_position: index?.queuePosition ?? null,
    total_actionable: index?.totalActionable ?? flattenActionableDailyRevenueWorkQueueItems(queue).length,
    priority: item.priority,
    action_label: ACTION_LABELS[item.action] ?? item.action,
    channel_label: CHANNEL_LABELS[item.recommendedChannel] ?? item.recommendedChannel,
    reasoning: item.reasoning,
    requires_human_approval: item.requiresHumanApproval,
  }
}

export function isReplyInterruptSource(source: string): boolean {
  return source === "reply_workflow" || source === "inbox_thread"
}

export function isHumanApprovalInterruptSource(source: string): boolean {
  return source === "human_approval"
}

export function compareByDailyWorkQueueIndex(
  leftLeadId: string | null | undefined,
  rightLeadId: string | null | undefined,
  index: Map<string, DailyRevenueWorkQueueIndexEntry>,
): number {
  const left = leftLeadId ? index.get(leftLeadId) : undefined
  const right = rightLeadId ? index.get(rightLeadId) : undefined
  if (left && right) return left.queuePosition - right.queuePosition
  if (left) return -1
  if (right) return 1
  return 0
}

/** Replies and human approvals stay on top; otherwise daily queue order wins. */
export function rankItemsWithDailyWorkQueue<T>(input: {
  items: T[]
  resolveLeadId: (item: T) => string | null | undefined
  resolveInterrupt: (item: T) => boolean
  queue: DailyRevenueWorkQueue | null | undefined
  fallbackCompare?: (left: T, right: T) => number
}): T[] {
  if (!input.queue) {
    return input.fallbackCompare ? [...input.items].sort(input.fallbackCompare) : [...input.items]
  }

  const index = buildDailyRevenueWorkQueueIndex(input.queue)
  return [...input.items].sort((left, right) => {
    const leftInterrupt = input.resolveInterrupt(left)
    const rightInterrupt = input.resolveInterrupt(right)
    if (leftInterrupt && !rightInterrupt) return -1
    if (!leftInterrupt && rightInterrupt) return 1

    const queueCompare = compareByDailyWorkQueueIndex(
      input.resolveLeadId(left),
      input.resolveLeadId(right),
      index,
    )
    if (queueCompare !== 0) return queueCompare

    return input.fallbackCompare ? input.fallbackCompare(left, right) : 0
  })
}

export function sortCallQueueRowsByDailyWorkQueue<T extends { leadId: string }>(
  rows: T[],
  queue: DailyRevenueWorkQueue | null | undefined,
): T[] {
  if (!queue) return rows

  const index = buildDailyRevenueWorkQueueIndex(queue)
  const callLeadIds = new Set(
    [...index.values()]
      .filter(
        (entry) =>
          entry.item.action === "place_call" ||
          entry.item.recommendedChannel === "phone" ||
          entry.item.recommendedChannel === "voice_drop",
      )
      .map((entry) => entry.item.leadId),
  )

  return [...rows].sort((left, right) => {
    const leftInCallQueue = callLeadIds.has(left.leadId)
    const rightInCallQueue = callLeadIds.has(right.leadId)
    if (leftInCallQueue && !rightInCallQueue) return -1
    if (!leftInCallQueue && rightInCallQueue) return 1
    return compareByDailyWorkQueueIndex(left.leadId, right.leadId, index)
  })
}

export function boostNotificationPriorityWithDailyWorkQueue(input: {
  leadId: string | null | undefined
  basePriorityScore: number
  queue: DailyRevenueWorkQueue | null | undefined
}): number {
  if (!input.queue || !input.leadId) return input.basePriorityScore
  const entry = buildDailyRevenueWorkQueueIndex(input.queue).get(input.leadId)
  if (!entry) return input.basePriorityScore
  const dispositionBoost = DISPOSITION_RANK[entry.item.priority] * 10
  const positionBoost = Math.max(0, 100 - entry.queuePosition)
  return input.basePriorityScore + dispositionBoost + positionBoost
}

export function buildEnrollmentPreviewQueueReason(input: {
  queue: DailyRevenueWorkQueue | null | undefined
  leadId: string
  scheduledToday: boolean
}): string | null {
  const status = resolveLeadDailyWorkQueueStatus(input.queue, input.leadId)
  if (!status.in_queue) {
    return input.scheduledToday ? null : "Not scheduled in today's Ava work queue."
  }
  if (status.priority === "waiting") {
    return `Waiting in today's queue — ${status.reasoning[0] ?? "capacity or timing"}`
  }
  if (status.priority === "blocked") {
    return `Blocked today — ${status.reasoning[0] ?? "disqualified or suppressed"}`
  }
  if (status.queue_position != null) {
    return `#${status.queue_position} of ${status.total_actionable} today · ${status.action_label} (${status.channel_label})`
  }
  return status.reasoning[0] ?? null
}
