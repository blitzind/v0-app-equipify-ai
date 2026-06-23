/** GE-AUTO-2A — Objective signal ingestion and progress tracking (client-safe). */

import type {
  GrowthObjective,
  GrowthObjectiveInboundSignal,
  GrowthObjectiveRecentSignal,
  GrowthObjectiveSignalSnapshot,
  GrowthObjectiveType,
} from "@/lib/growth/objectives/growth-objective-types"

export function buildObjectiveSignalSnapshot(
  signals: GrowthObjectiveRecentSignal[],
): GrowthObjectiveSignalSnapshot {
  let opens = 0
  let clicks = 0
  let replies = 0
  let videoViews = 0
  let videoCompletions = 0
  let bookings = 0
  let opportunities = 0
  let customers = 0

  for (const signal of signals) {
    switch (signal.type) {
      case "engagement_open":
        opens += 1
        break
      case "engagement_click":
        clicks += 1
        break
      case "reply":
        replies += 1
        break
      case "video_view":
        videoViews += 1
        break
      case "video_completion":
        videoCompletions += 1
        break
      case "booking_completed":
      case "meeting_booked":
        bookings += 1
        break
      case "opportunity_created":
        opportunities += 1
        break
      case "customer_closed":
        customers += 1
        break
      default:
        break
    }
  }

  const engagementScore = Math.min(100, opens * 2 + clicks * 4 + replies * 8 + videoCompletions * 6)
  const intentScore = Math.min(
    100,
    bookings * 20 + videoCompletions * 5 + replies * 10 + opportunities * 8 + customers * 25,
  )
  const sequenceOpenRate = opens > 0 ? Math.min(1, opens / Math.max(opens + 10, 1)) : 0
  const sequenceReplyRate = opens > 0 ? Math.min(1, replies / Math.max(opens, 1)) : 0

  return {
    opens,
    clicks,
    replies,
    videoViews,
    videoCompletions,
    bookings,
    opportunities,
    customers,
    engagementScore,
    intentScore,
    sequenceReplyRate,
    sequenceOpenRate,
  }
}

export function computeObjectiveProgressDelta(
  objectiveType: GrowthObjectiveType,
  signal: GrowthObjectiveInboundSignal,
): number {
  switch (objectiveType) {
    case "demos_booked":
      return signal.type === "booking_completed" ? 1 : 0
    case "meetings_booked":
      return signal.type === "meeting_booked" || signal.type === "booking_completed" ? 1 : 0
    case "opportunities_created":
      return signal.type === "opportunity_created" ? 1 : 0
    case "pipeline_value":
      return signal.type === "opportunity_created" ? Number(signal.value ?? 0) : 0
    case "customers_acquired":
      return signal.type === "customer_closed" ? 1 : 0
    default:
      return signal.type === "booking_completed" ? 1 : 0
  }
}

export function isDuplicateObjectiveSignalIngest(
  objective: GrowthObjective,
  signal: GrowthObjectiveInboundSignal,
): boolean {
  const key = signal.payload?.idempotencyKey
  if (!key || typeof key !== "string") return false
  return (objective.recentSignals ?? []).some(
    (entry) => entry.payload?.idempotencyKey === key,
  )
}

export function appendObjectiveRecentSignal(
  current: GrowthObjectiveRecentSignal[],
  signal: GrowthObjectiveInboundSignal,
  objectiveId: string,
): GrowthObjectiveRecentSignal[] {
  const entry: GrowthObjectiveRecentSignal = {
    ...signal,
    id: `${objectiveId}:${signal.type}:${signal.ts ?? Date.now()}`,
    receivedAt: signal.ts ?? new Date().toISOString(),
  }
  return [entry, ...current].slice(0, 50)
}

export function isObjectiveComplete(objective: GrowthObjective): boolean {
  return objective.currentValue >= objective.targetValue && objective.targetValue > 0
}

export function estimateObjectiveCompletionDate(input: {
  currentValue: number
  targetValue: number
  forecastDays: number
  startedAt: string | null
}): string | null {
  if (input.currentValue >= input.targetValue) return new Date().toISOString()
  if (!input.startedAt || input.forecastDays <= 0) return null
  const remainingRatio = Math.max(0, input.targetValue - input.currentValue) / Math.max(input.targetValue, 1)
  const daysRemaining = Math.ceil(input.forecastDays * remainingRatio)
  const date = new Date(input.startedAt)
  date.setUTCDate(date.getUTCDate() + daysRemaining)
  return date.toISOString()
}
