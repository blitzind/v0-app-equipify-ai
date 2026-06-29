/**
 * GE-AIOS-SDR-2A — Ava Daily Revenue Work Queue Engine.
 * Consumes canonical IRE stack + Communication Strategy — no duplicate NBA reasoning.
 * Deterministic prioritization and capacity planning only. Never executes.
 */

import type { CommunicationStrategyRecommendedAction } from "@/lib/growth/contact-verification/communication-strategy-types"
import {
  DEFAULT_DAILY_REVENUE_WORK_QUEUE_CAPACITY,
  GROWTH_DAILY_REVENUE_WORK_QUEUE_QA_MARKER,
  type DailyRevenueWorkQueue,
  type DailyRevenueWorkQueueCapacityLimits,
  type DailyRevenueWorkQueueCandidate,
  type DailyRevenueWorkQueueWorkingHours,
  type WorkQueueDisposition,
  type WorkQueueItem,
  type WorkQueuePriority,
} from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-types"

export type DailyRevenueWorkQueueEngineInput = {
  generatedAt?: string
  candidates: DailyRevenueWorkQueueCandidate[]
  capacityLimits?: DailyRevenueWorkQueueCapacityLimits
  workingHours?: DailyRevenueWorkQueueWorkingHours
  suppressionList?: string[]
}

const ACTION_MINUTES: Record<CommunicationStrategyRecommendedAction, number> = {
  send_email: 8,
  place_call: 12,
  launch_voice_drop: 5,
  send_sms: 6,
  create_linkedin_task: 10,
  send_video: 15,
  schedule_meeting: 20,
  wait: 0,
  stop: 0,
  request_human_review: 15,
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(1000, Math.round(value)))
}

function buildTaskKey(leadId: string, action: CommunicationStrategyRecommendedAction): string {
  return `${leadId}:${action}`
}

function isWithinWorkingHours(workingHours?: DailyRevenueWorkQueueWorkingHours, now = new Date()): boolean {
  if (!workingHours?.startHour && workingHours?.endHour === undefined) return true
  const useUtc = workingHours?.timezone === "UTC" || !workingHours?.timezone
  const hour = useUtc ? now.getUTCHours() : now.getHours()
  const start = workingHours?.startHour ?? 8
  const end = workingHours?.endHour ?? 18
  return hour >= start && hour < end
}

function resolvePriorityTier(input: DailyRevenueWorkQueueCandidate): {
  disposition: WorkQueueDisposition
  sortScore: number
  dueAt: string | null
  reasoning: string[]
} {
  const { communicationStrategy, nextBestAction, revenueExecutionPlan, replyIntelligence, meetingState } =
    input
  const strategy = communicationStrategy
  const reasoning: string[] = [...strategy.reasoning.slice(0, 2)]

  if (input.suppressed) {
    return {
      disposition: "blocked",
      sortScore: 0,
      dueAt: null,
      reasoning: ["Suppressed — excluded from daily queue", ...reasoning],
    }
  }

  if (input.completedToday) {
    return {
      disposition: "completed",
      sortScore: 0,
      dueAt: null,
      reasoning: ["Completed today", ...reasoning],
    }
  }

  if (
    input.qualification.qualification === "disqualified" ||
    nextBestAction.action === "disqualify" ||
    strategy.recommendedAction === "stop"
  ) {
    return {
      disposition: "blocked",
      sortScore: 10,
      dueAt: null,
      reasoning: ["Disqualified — no outreach", ...reasoning],
    }
  }

  if (replyIntelligence?.negativeReply || strategy.recommendedAction === "stop") {
    return {
      disposition: "blocked",
      sortScore: 15,
      dueAt: null,
      reasoning: ["Negative reply — stop outreach", ...reasoning],
    }
  }

  if (meetingState?.meetingToday || strategy.recommendedAction === "schedule_meeting") {
    return {
      disposition: "critical",
      sortScore: clampScore(900 + strategy.confidence * 0.1),
      dueAt: meetingState?.meetingScheduledAt ?? null,
      reasoning: ["Meeting today — highest priority", ...reasoning],
    }
  }

  if (replyIntelligence?.positiveReply || input.touchHistory?.positiveReply) {
    return {
      disposition: "critical",
      sortScore: clampScore(850 + strategy.confidence * 0.1),
      dueAt: null,
      reasoning: ["Positive reply — respond and advance", ...reasoning],
    }
  }

  if (
    revenueExecutionPlan.approvalsRequired.length > 0 ||
    strategy.recommendedAction === "request_human_review" ||
    nextBestAction.action === "manual_review"
  ) {
    return {
      disposition: "high",
      sortScore: clampScore(800 + strategy.confidence * 0.08),
      dueAt: null,
      reasoning: ["Human approval waiting", ...reasoning],
    }
  }

  if (input.inboxState?.needsAction || (input.inboxState?.unreadReplies ?? 0) > 0) {
    return {
      disposition: "high",
      sortScore: clampScore(780 + strategy.confidence * 0.08),
      dueAt: null,
      reasoning: ["Inbox reply needs action", ...reasoning],
    }
  }

  if (
    strategy.recommendedAction === "wait" ||
    nextBestAction.action === "monitor_buying_signals" ||
    revenueExecutionPlan.executionState === "waiting"
  ) {
    return {
      disposition: "waiting",
      sortScore: clampScore(100 + strategy.confidence * 0.05),
      dueAt: null,
      reasoning: ["Wait — nurture or monitor signals", ...reasoning],
    }
  }

  if (
    revenueExecutionPlan.executionState === "blocked" ||
    nextBestAction.executionReadiness === "blocked" ||
    input.campaignState?.enrollmentBlocked
  ) {
    return {
      disposition: "blocked",
      sortScore: clampScore(50),
      dueAt: null,
      reasoning: ["Blocked — prerequisites incomplete", ...reasoning],
    }
  }

  if (nextBestAction.action === "verify_contact" || revenueExecutionPlan.recommendedWorkflow === "verification") {
    return {
      disposition: "medium",
      sortScore: clampScore(500 + strategy.confidence * 0.06),
      dueAt: null,
      reasoning: ["Verification needed before outreach", ...reasoning],
    }
  }

  if (
    nextBestAction.action === "research_company" ||
    nextBestAction.action === "identify_decision_maker" ||
    revenueExecutionPlan.recommendedWorkflow === "research"
  ) {
    return {
      disposition: "medium",
      sortScore: clampScore(400 + strategy.confidence * 0.05),
      dueAt: null,
      reasoning: ["Research required", ...reasoning],
    }
  }

  if (
    input.qualification.qualification === "qualified" &&
    revenueExecutionPlan.executionState === "ready" &&
    strategy.recommendedAction !== "wait" &&
    strategy.recommendedAction !== "stop"
  ) {
    const band: WorkQueuePriority =
      nextBestAction.priority === "critical"
        ? "critical"
        : nextBestAction.priority === "high"
          ? "high"
          : nextBestAction.priority === "medium"
            ? "medium"
            : "low"
    const base =
      band === "critical" ? 700 : band === "high" ? 650 : band === "medium" ? 550 : 450
    return {
      disposition: band,
      sortScore: clampScore(base + strategy.confidence * 0.1),
      dueAt: null,
      reasoning: ["Qualified — outreach ready via communication strategy", ...reasoning],
    }
  }

  return {
    disposition: "low",
    sortScore: clampScore(200 + strategy.confidence * 0.04),
    dueAt: null,
    reasoning: ["Nurture — lower priority today", ...reasoning],
  }
}

function mapChannelForCapacity(channel: WorkQueueItem["recommendedChannel"]): string {
  if (channel === "phone") return "phone"
  if (channel === "voice_drop") return "voice_drop"
  if (channel === "human") return "phone"
  if (channel === "stop" || channel === "wait") return "none"
  return channel
}

function compareWorkQueueItems(a: WorkQueueItem, b: WorkQueueItem): number {
  if (b.sortScore !== a.sortScore) return b.sortScore - a.sortScore
  if (b.confidence !== a.confidence) return b.confidence - a.confidence
  return a.leadId.localeCompare(b.leadId)
}

function buildCandidateItem(
  candidate: DailyRevenueWorkQueueCandidate,
  generatedAt: string,
): WorkQueueItem | null {
  const strategy = candidate.communicationStrategy
  const taskKey = buildTaskKey(candidate.leadId, strategy.recommendedAction)

  const existingCompleted = candidate.existingTasks?.some(
    (task) => task.taskKey === taskKey && task.status === "completed",
  )
  if (existingCompleted || candidate.completedToday) {
    return {
      leadId: candidate.leadId,
      companyId: candidate.companyId,
      priority: "completed",
      action: strategy.recommendedAction,
      communicationStrategy: {
        primaryChannel: strategy.primaryChannel,
        recommendedAction: strategy.recommendedAction,
        confidence: strategy.confidence,
        requiresHumanApproval: strategy.requiresHumanApproval,
      },
      recommendedChannel: strategy.primaryChannel,
      estimatedMinutes: ACTION_MINUTES[strategy.recommendedAction] ?? 10,
      confidence: strategy.confidence,
      requiresHumanApproval: strategy.requiresHumanApproval,
      dueAt: null,
      reasoning: ["Already completed today"],
      sortScore: 0,
      taskKey,
    }
  }

  const existingPending = candidate.existingTasks?.some(
    (task) => task.taskKey === taskKey && task.status !== "cancelled",
  )
  if (existingPending) {
    return null
  }

  const tier = resolvePriorityTier(candidate)
  return {
    leadId: candidate.leadId,
    companyId: candidate.companyId,
    priority: tier.disposition,
    action: strategy.recommendedAction,
    communicationStrategy: {
      primaryChannel: strategy.primaryChannel,
      recommendedAction: strategy.recommendedAction,
      confidence: strategy.confidence,
      requiresHumanApproval: strategy.requiresHumanApproval,
    },
    recommendedChannel: strategy.primaryChannel,
    estimatedMinutes: ACTION_MINUTES[strategy.recommendedAction] ?? 10,
    confidence: strategy.confidence,
    requiresHumanApproval: strategy.requiresHumanApproval,
    dueAt: tier.dueAt,
    reasoning: tier.reasoning,
    sortScore: tier.sortScore,
    taskKey,
  }
}

function applyCapacityLimits(input: {
  items: WorkQueueItem[]
  capacity: DailyRevenueWorkQueueCapacityLimits
}): { scheduled: WorkQueueItem[]; deferred: WorkQueueItem[]; channelAllocation: Record<string, number> } {
  const limits = {
    ...DEFAULT_DAILY_REVENUE_WORK_QUEUE_CAPACITY.channelLimits,
    ...input.capacity.channelLimits,
  }
  const channelCounts: Record<string, number> = {}
  const scheduled: WorkQueueItem[] = []
  const deferred: WorkQueueItem[] = []
  let minutesUsed = 0
  const maxMinutes = input.capacity.dailyCapacityMinutes ?? 480
  const mailboxCap = Math.min(
    limits.email ?? 18,
    input.capacity.mailboxDailyLimit ?? 18,
    input.capacity.warmupDailyLimit ?? 18,
  )

  for (const item of input.items) {
    if (item.priority === "waiting" || item.priority === "blocked" || item.priority === "completed") {
      scheduled.push(item)
      continue
    }

    const channel = mapChannelForCapacity(item.recommendedChannel)
    if (channel === "none") {
      scheduled.push(item)
      continue
    }

    const channelLimit =
      channel === "email"
        ? mailboxCap
        : channel === "phone"
          ? (limits.phone ?? 7)
          : channel === "voice_drop"
            ? (limits.voice_drop ?? 3)
            : channel === "sms"
              ? (limits.sms ?? 5)
              : channel === "linkedin"
                ? (limits.linkedin ?? 10)
                : channel === "video"
                  ? (limits.video ?? 5)
                  : channel === "meeting"
                    ? (limits.meeting ?? 2)
                    : 999

    const used = channelCounts[channel] ?? 0
    const nextMinutes = minutesUsed + item.estimatedMinutes

    if (used >= channelLimit) {
      deferred.push({
        ...item,
        priority: "waiting",
        reasoning: [...item.reasoning, `Daily ${channel.replace(/_/g, " ")} capacity reached`],
        sortScore: Math.max(0, item.sortScore - 200),
      })
      continue
    }

    if (nextMinutes > maxMinutes) {
      deferred.push({
        ...item,
        priority: "waiting",
        reasoning: [...item.reasoning, "Daily operator capacity reached"],
        sortScore: Math.max(0, item.sortScore - 150),
      })
      continue
    }

    channelCounts[channel] = used + 1
    minutesUsed = nextMinutes
    scheduled.push(item)
  }

  return { scheduled, deferred, channelAllocation: channelCounts }
}

function bucketItems(items: WorkQueueItem[]): Pick<
  DailyRevenueWorkQueue,
  "critical" | "high" | "medium" | "low" | "waiting" | "blocked" | "completed"
> {
  const buckets = {
    critical: [] as WorkQueueItem[],
    high: [] as WorkQueueItem[],
    medium: [] as WorkQueueItem[],
    low: [] as WorkQueueItem[],
    waiting: [] as WorkQueueItem[],
    blocked: [] as WorkQueueItem[],
    completed: [] as WorkQueueItem[],
  }

  for (const item of items) {
    switch (item.priority) {
      case "critical":
        buckets.critical.push(item)
        break
      case "high":
        buckets.high.push(item)
        break
      case "medium":
        buckets.medium.push(item)
        break
      case "low":
        buckets.low.push(item)
        break
      case "waiting":
        buckets.waiting.push(item)
        break
      case "blocked":
        buckets.blocked.push(item)
        break
      case "completed":
        buckets.completed.push(item)
        break
      default:
        buckets.low.push(item)
    }
  }

  for (const key of Object.keys(buckets) as Array<keyof typeof buckets>) {
    buckets[key].sort(compareWorkQueueItems)
  }

  return buckets
}

/**
 * Primary export — builds one prioritized daily work queue from canonical artifacts.
 */
export function buildDailyRevenueWorkQueue(input: DailyRevenueWorkQueueEngineInput): DailyRevenueWorkQueue {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const capacity = {
    ...DEFAULT_DAILY_REVENUE_WORK_QUEUE_CAPACITY,
    ...input.capacityLimits,
    channelLimits: {
      ...DEFAULT_DAILY_REVENUE_WORK_QUEUE_CAPACITY.channelLimits,
      ...input.capacityLimits?.channelLimits,
    },
  }
  const suppression = new Set(input.suppressionList ?? [])
  const queueNow = new Date(generatedAt)
  const withinHours = isWithinWorkingHours(input.workingHours, queueNow)

  const rawItems: WorkQueueItem[] = []
  const seenKeys = new Set<string>()

  for (const candidate of input.candidates) {
    if (suppression.has(candidate.leadId) || suppression.has(candidate.companyId)) continue

    const item = buildCandidateItem(candidate, generatedAt)
    if (!item) continue
    if (seenKeys.has(item.taskKey)) continue
    seenKeys.add(item.taskKey)

    if (!withinHours && item.priority !== "critical" && item.priority !== "completed") {
      rawItems.push({
        ...item,
        priority: "waiting",
        reasoning: [...item.reasoning, "Outside working hours"],
        sortScore: Math.max(0, item.sortScore - 100),
      })
      continue
    }

    rawItems.push(item)
  }

  rawItems.sort(compareWorkQueueItems)

  const actionable = rawItems.filter(
    (item) => !["waiting", "blocked", "completed"].includes(item.priority),
  )
  const passive = rawItems.filter((item) => ["waiting", "blocked", "completed"].includes(item.priority))

  const { scheduled, deferred, channelAllocation } = applyCapacityLimits({
    items: actionable,
    capacity,
  })

  const merged = [...scheduled, ...deferred, ...passive].sort(compareWorkQueueItems)
  const buckets = bucketItems(merged)
  const estimatedWorkloadMinutes = scheduled
    .filter((item) => !["waiting", "blocked", "completed"].includes(item.priority))
    .reduce((sum, item) => sum + item.estimatedMinutes, 0)

  return {
    version: 1,
    qa_marker: GROWTH_DAILY_REVENUE_WORK_QUEUE_QA_MARKER,
    generatedAt,
    totalAccounts: input.candidates.length,
    estimatedWorkloadMinutes,
    suggestedDailyCapacity: capacity.suggestedDailyItemCount ?? 35,
    channelAllocation,
    ...buckets,
  }
}

export function summarizeDailyRevenueWorkQueue(queue: DailyRevenueWorkQueue): {
  actionableCount: number
  waitingCount: number
  blockedCount: number
  channelSummary: string
} {
  const actionableCount =
    queue.critical.length + queue.high.length + queue.medium.length + queue.low.length
  const parts = Object.entries(queue.channelAllocation)
    .filter(([, count]) => count > 0)
    .map(([channel, count]) => `${count} ${channel.replace(/_/g, " ")}`)
  return {
    actionableCount,
    waitingCount: queue.waiting.length,
    blockedCount: queue.blocked.length,
    channelSummary: parts.length > 0 ? parts.join(" · ") : "No channel allocation yet",
  }
}
