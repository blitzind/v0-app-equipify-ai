import type { ExecutionOperatorScore, ExecutionOperatorScoreTrend } from "@/lib/growth/execution/execution-priority-types"

export type ExecutionTimelineEvent = {
  eventType: string
  occurredAt: string
}

const FOLLOW_UP_EVENTS = new Set(["follow_up_completed", "manual_touch"])
const CRITICAL_EVENTS = new Set([
  "executive_intervention_recommended",
  "follow_up_completed",
  "outreach_executed",
  "call_copilot_session_completed",
  "meeting_completed",
])
const MEETING_EVENTS = new Set(["meeting_completed", "meeting_scheduled"])
const REPLY_EVENTS = new Set(["reply_received", "reply_handled", "follow_up_completed"])
const RESEARCH_EVENTS = new Set(["research_completed"])
const COACHING_EVENTS = new Set(["call_copilot_summary_approved", "call_copilot_session_completed"])
const STALE_RECOVERY_EVENTS = new Set(["lead_became_sales_ready", "forecast_regression_detected", "follow_up_completed"])

function filterEventsSince(events: ExecutionTimelineEvent[], sinceMs: number): ExecutionTimelineEvent[] {
  return events.filter((event) => Date.parse(event.occurredAt) >= sinceMs)
}

function computeTrend(events: ExecutionTimelineEvent[]): ExecutionOperatorScoreTrend {
  const followUpsCompleted = events.filter((e) => FOLLOW_UP_EVENTS.has(e.eventType)).length
  const criticalTasksCompleted = events.filter((e) => CRITICAL_EVENTS.has(e.eventType)).length
  const meetingsCompleted = events.filter((e) => MEETING_EVENTS.has(e.eventType)).length
  const repliesHandled = events.filter((e) => REPLY_EVENTS.has(e.eventType)).length
  const researchCoverage = events.filter((e) => RESEARCH_EVENTS.has(e.eventType)).length
  const callCoachingImprovement = events.filter((e) => COACHING_EVENTS.has(e.eventType)).length
  const staleOpportunityRecovery = events.filter((e) => STALE_RECOVERY_EVENTS.has(e.eventType)).length

  const raw =
    followUpsCompleted * 8 +
    criticalTasksCompleted * 12 +
    meetingsCompleted * 10 +
    repliesHandled * 9 +
    researchCoverage * 6 +
    callCoachingImprovement * 7 +
    staleOpportunityRecovery * 11

  const score = Math.max(0, Math.min(100, Math.round(raw / Math.max(1, events.length / 3 + 1))))

  return {
    score,
    followUpsCompleted,
    criticalTasksCompleted,
    meetingsCompleted,
    repliesHandled,
    researchCoverage,
    callCoachingImprovement,
    staleOpportunityRecovery,
  }
}

export function computeExecutionOperatorScore(
  events: ExecutionTimelineEvent[],
  nowMs = Date.now(),
): ExecutionOperatorScore {
  const day7 = nowMs - 7 * 24 * 60 * 60 * 1000
  const day30 = nowMs - 30 * 24 * 60 * 60 * 1000
  const todayStart = new Date(nowMs)
  todayStart.setHours(0, 0, 0, 0)

  return {
    current: computeTrend(filterEventsSince(events, todayStart.getTime())),
    trend7Day: computeTrend(filterEventsSince(events, day7)),
    trend30Day: computeTrend(filterEventsSince(events, day30)),
  }
}

export function computeExecutionCompletionPercent(input: {
  queueItems: number
  criticalCompleted: number
  actionsCompletedToday: number
}): number {
  if (input.queueItems === 0) return 100
  const addressed = input.criticalCompleted + input.actionsCompletedToday
  return Math.max(0, Math.min(100, Math.round((addressed / Math.max(input.queueItems, 1)) * 100)))
}
