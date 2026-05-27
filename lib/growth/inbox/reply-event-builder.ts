/** Deterministic reply intelligence event drafts. Client-safe. */

import type { GrowthInboxClassification, GrowthInboxTimelineEventType, GrowthReplyEventSeverity } from "@/lib/growth/inbox/inbox-types"

export type ReplyEventDraft = {
  event_type: string
  severity: GrowthReplyEventSeverity
  title: string
  description: string
  timeline_type?: GrowthInboxTimelineEventType
  metadata?: Record<string, unknown>
}

export function buildReplyDetectedEvent(leadLabel: string, subject: string): ReplyEventDraft {
  return {
    event_type: "reply_detected",
    severity: "low",
    title: "Reply detected",
    description: `Inbound reply recorded for ${leadLabel}${subject ? `: ${subject}` : ""}.`,
    timeline_type: "reply_detected",
  }
}

export function buildClassificationEvent(
  leadLabel: string,
  classification: GrowthInboxClassification,
): ReplyEventDraft | null {
  switch (classification) {
    case "positive_interest":
      return {
        event_type: "positive_interest_detected",
        severity: "medium",
        title: "Positive interest detected",
        description: `${leadLabel} showed positive interest signals.`,
        timeline_type: "positive_interest_detected",
      }
    case "budget":
      return {
        event_type: "budget_objection_detected",
        severity: "medium",
        title: "Budget concern detected",
        description: `${leadLabel} mentioned budget or pricing language.`,
        timeline_type: "budget_objection_detected",
      }
    case "timeline":
      return {
        event_type: "timeline_objection_detected",
        severity: "medium",
        title: "Timeline concern detected",
        description: `${leadLabel} mentioned timeline or timing language.`,
        timeline_type: "timeline_objection_detected",
      }
    case "meeting_intent":
      return {
        event_type: "meeting_interest_detected",
        severity: "high",
        title: "Meeting interest detected",
        description: `${leadLabel} expressed meeting or call interest.`,
        timeline_type: "meeting_interest_detected",
      }
    case "unsubscribe":
      return {
        event_type: "unsubscribe_detected",
        severity: "critical",
        title: "Unsubscribe detected",
        description: `${leadLabel} requested to stop or unsubscribe.`,
        timeline_type: "unsubscribe_detected",
      }
    default:
      return null
  }
}

export function buildThreadOwnerAssignedEvent(leadLabel: string, ownerLabel: string): ReplyEventDraft {
  return {
    event_type: "thread_owner_assigned",
    severity: "low",
    title: "Thread owner assigned",
    description: `${leadLabel} assigned to ${ownerLabel}.`,
    timeline_type: "thread_owner_assigned",
    metadata: { owner_label: ownerLabel },
  }
}

export function buildReplyIntelligenceEvents(input: {
  leadLabel: string
  subject: string
  classification: GrowthInboxClassification
  isInbound: boolean
}): ReplyEventDraft[] {
  const events: ReplyEventDraft[] = []
  if (input.isInbound) {
    events.push(buildReplyDetectedEvent(input.leadLabel, input.subject))
  }
  const classificationEvent = buildClassificationEvent(input.leadLabel, input.classification)
  if (classificationEvent) events.push(classificationEvent)
  return events
}
