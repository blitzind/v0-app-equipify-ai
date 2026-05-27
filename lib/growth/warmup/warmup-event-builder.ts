/** Deterministic warmup event drafts + timeline mapping. Client-safe. */

import type {
  GrowthWarmupEventSeverity,
  GrowthWarmupProfileStatus,
  GrowthWarmupTimelineEventType,
} from "@/lib/growth/warmup/warmup-types"

export type WarmupEventDraft = {
  event_type: string
  severity: GrowthWarmupEventSeverity
  title: string
  description: string
  timeline_type?: GrowthWarmupTimelineEventType
  metadata?: Record<string, unknown>
}

export function buildWarmupStartedEvent(senderEmail: string): WarmupEventDraft {
  return {
    event_type: "warmup_started",
    severity: "low",
    title: "Warmup started",
    description: `Warmup schedule generated for ${senderEmail}.`,
    timeline_type: "warmup_started",
  }
}

export function buildWarmupPausedEvent(senderEmail: string): WarmupEventDraft {
  return {
    event_type: "warmup_paused",
    severity: "medium",
    title: "Warmup paused",
    description: `Warmup progression paused for ${senderEmail}.`,
    timeline_type: "warmup_paused",
  }
}

export function buildWarmupCompletedEvent(senderEmail: string): WarmupEventDraft {
  return {
    event_type: "warmup_completed",
    severity: "low",
    title: "Warmup completed",
    description: `Warmup plan completed for ${senderEmail}.`,
    timeline_type: "warmup_completed",
  }
}

export function buildWarmupHealthDeclinedEvent(
  senderEmail: string,
  previousScore: number,
  nextScore: number,
): WarmupEventDraft {
  return {
    event_type: "warmup_health_declined",
    severity: nextScore < 40 ? "critical" : "high",
    title: "Warmup health declined",
    description: `Warmup score for ${senderEmail} dropped from ${previousScore} to ${nextScore}.`,
    timeline_type: "warmup_health_declined",
    metadata: { previous_score: previousScore, current_score: nextScore },
  }
}

export function buildWarmupProgressMilestoneEvent(senderEmail: string, milestone: number): WarmupEventDraft {
  return {
    event_type: "warmup_progress_milestone",
    severity: "low",
    title: "Warmup progress milestone",
    description: `${senderEmail} reached ${milestone}% warmup progress.`,
    timeline_type: "warmup_progress_milestone",
    metadata: { milestone_percent: milestone },
  }
}

export function buildWarmupHealthWarningEvent(senderEmail: string, reason: string): WarmupEventDraft {
  return {
    event_type: "warmup_health_warning",
    severity: "medium",
    title: "Warmup health warning",
    description: `${senderEmail}: ${reason}`,
    metadata: { reason },
  }
}

export function buildWarmupResumeEvent(senderEmail: string): WarmupEventDraft {
  return {
    event_type: "warmup_resumed",
    severity: "low",
    title: "Warmup resumed",
    description: `Warmup progression resumed for ${senderEmail}.`,
    metadata: { resumed: true },
  }
}

export function buildWarmupStatusChangeEvents(input: {
  senderEmail: string
  previousStatus: GrowthWarmupProfileStatus
  nextStatus: GrowthWarmupProfileStatus
  previousScore: number
  nextScore: number
  previousProgress: number
  nextProgress: number
  progressMilestone?: number | null
}): WarmupEventDraft[] {
  const events: WarmupEventDraft[] = []

  if (input.previousStatus !== "warming" && input.nextStatus === "warming") {
    events.push(buildWarmupStartedEvent(input.senderEmail))
  }
  if (input.nextStatus === "paused" && input.previousStatus !== "paused") {
    events.push(buildWarmupPausedEvent(input.senderEmail))
  }
  if (input.nextStatus === "warming" && input.previousStatus === "paused") {
    events.push(buildWarmupResumeEvent(input.senderEmail))
  }
  if (input.nextStatus === "completed" && input.previousStatus !== "completed") {
    events.push(buildWarmupCompletedEvent(input.senderEmail))
  }
  if (input.nextScore < input.previousScore) {
    events.push(buildWarmupHealthDeclinedEvent(input.senderEmail, input.previousScore, input.nextScore))
  }
  if (input.progressMilestone != null) {
    events.push(buildWarmupProgressMilestoneEvent(input.senderEmail, input.progressMilestone))
  }

  return events
}
