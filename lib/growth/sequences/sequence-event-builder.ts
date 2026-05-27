/** Deterministic sequence event drafts. Client-safe. */

import type { GrowthSequenceEventSeverity, GrowthSequenceTimelineEventType } from "@/lib/growth/sequences/sequence-types"

export type SequenceEventDraft = {
  event_type: string
  severity: GrowthSequenceEventSeverity
  title: string
  description: string
  timeline_type?: GrowthSequenceTimelineEventType
  metadata?: Record<string, unknown>
}

export function buildSequenceCreatedEvent(templateName: string): SequenceEventDraft {
  return {
    event_type: "sequence_created",
    severity: "low",
    title: "Sequence template created",
    description: `Template "${templateName}" created.`,
    timeline_type: "sequence_created",
  }
}

export function buildSequenceStartedEvent(leadLabel: string, sequenceName: string): SequenceEventDraft {
  return {
    event_type: "sequence_started",
    severity: "low",
    title: "Sequence started",
    description: `${leadLabel} enrolled in "${sequenceName}".`,
    timeline_type: "sequence_started",
  }
}

export function buildSequencePausedEvent(leadLabel: string, sequenceName: string): SequenceEventDraft {
  return {
    event_type: "sequence_paused",
    severity: "medium",
    title: "Sequence paused",
    description: `Sequence "${sequenceName}" paused for ${leadLabel}.`,
    timeline_type: "sequence_paused",
  }
}

export function buildSequenceCompletedEvent(leadLabel: string, sequenceName: string, reason: string): SequenceEventDraft {
  return {
    event_type: "sequence_completed",
    severity: "low",
    title: "Sequence completed",
    description: `${leadLabel} completed "${sequenceName}" — ${reason}.`,
    timeline_type: "sequence_completed",
    metadata: { completion_reason: reason },
  }
}

export function buildSequenceCancelledEvent(leadLabel: string, sequenceName: string, reason: string): SequenceEventDraft {
  return {
    event_type: "sequence_cancelled",
    severity: "medium",
    title: "Sequence cancelled",
    description: `${leadLabel} cancelled "${sequenceName}" — ${reason}.`,
    timeline_type: "sequence_cancelled",
    metadata: { completion_reason: reason },
  }
}

export function buildSequenceHealthDeclinedEvent(
  leadLabel: string,
  previousScore: number,
  nextScore: number,
): SequenceEventDraft {
  return {
    event_type: "sequence_health_declined",
    severity: nextScore < 40 ? "critical" : "high",
    title: "Sequence health declined",
    description: `Sequence health for ${leadLabel} dropped from ${previousScore} to ${nextScore}.`,
    timeline_type: "sequence_health_declined",
    metadata: { previous_score: previousScore, current_score: nextScore },
  }
}

export function buildSequenceFailedEvent(leadLabel: string, sequenceName: string, reason: string): SequenceEventDraft {
  return {
    event_type: "sequence_failed",
    severity: "critical",
    title: "Sequence failed",
    description: `${leadLabel} failed "${sequenceName}" — ${reason}.`,
    metadata: { failure_reason: reason },
  }
}

export function buildSequenceStatusChangeEvents(input: {
  leadLabel: string
  sequenceName: string
  previousStatus: string
  nextStatus: string
  previousScore: number
  nextScore: number
  completionReason?: string | null
}): SequenceEventDraft[] {
  const events: SequenceEventDraft[] = []

  if (input.previousStatus !== "active" && input.nextStatus === "active") {
    events.push(buildSequenceStartedEvent(input.leadLabel, input.sequenceName))
  }
  if (input.nextStatus === "paused" && input.previousStatus !== "paused") {
    events.push(buildSequencePausedEvent(input.leadLabel, input.sequenceName))
  }
  if (input.nextStatus === "completed" && input.previousStatus !== "completed") {
    events.push(
      buildSequenceCompletedEvent(input.leadLabel, input.sequenceName, input.completionReason ?? "completed"),
    )
  }
  if (input.nextStatus === "cancelled" && input.previousStatus !== "cancelled") {
    events.push(
      buildSequenceCancelledEvent(input.leadLabel, input.sequenceName, input.completionReason ?? "cancelled"),
    )
  }
  if (input.nextStatus === "failed" && input.previousStatus !== "failed") {
    events.push(buildSequenceFailedEvent(input.leadLabel, input.sequenceName, input.completionReason ?? "failed"))
  }
  if (input.nextScore < input.previousScore) {
    events.push(buildSequenceHealthDeclinedEvent(input.leadLabel, input.previousScore, input.nextScore))
  }

  return events
}
