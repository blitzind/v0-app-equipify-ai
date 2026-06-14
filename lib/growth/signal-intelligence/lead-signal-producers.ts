/** Build lead signal events from domain producers — client-safe builders. */

import type { GrowthReplyIntent } from "@/lib/growth/reply-intelligence/reply-intent-types"
import type { LeadSignalEvent } from "@/lib/growth/signal-intelligence/lead-signal-event-types"

const POSITIVE_INTENTS = new Set<GrowthReplyIntent>([
  "meeting_request",
  "demo_request",
  "positive_interest",
  "pricing_question",
])

const NEGATIVE_INTENTS = new Set<GrowthReplyIntent>([
  "not_interested",
  "unsubscribe",
  "negative",
  "out_of_office",
])

function baseReplyEvent(input: {
  leadId: string
  replyId: string
  confidence: number
  occurredAt?: string
  metadata?: Record<string, unknown>
}): Pick<LeadSignalEvent, "leadId" | "evidenceRef" | "occurredAt" | "metadata"> {
  return {
    leadId: input.leadId,
    evidenceRef: { table: "outbound_replies", id: input.replyId },
    occurredAt: input.occurredAt,
    metadata: input.metadata,
  }
}

export function buildReplyLeadSignalEvents(input: {
  leadId: string
  replyId: string
  intent: GrowthReplyIntent
  confidence: number
  occurredAt?: string
}): LeadSignalEvent[] {
  const common = baseReplyEvent(input)
  const events: LeadSignalEvent[] = [
    {
      ...common,
      sourceDomain: "reply",
      signalType: "reply_received",
      confidence: input.confidence,
      urgency: "normal",
      attributionImpacting: false,
      recomputeScope: "full",
      routeActions: ["timeline", "attention"],
    },
  ]

  if (input.intent === "meeting_request" || input.intent === "demo_request") {
    events.push({
      ...common,
      sourceDomain: "reply",
      signalType: "meeting_requested",
      confidence: Math.max(input.confidence, 0.75),
      urgency: "high",
      attributionImpacting: false,
      recomputeScope: "full",
      routeActions: ["timeline", "attention", "queue_hint"],
      metadata: { intent: input.intent },
    })
  }

  if (POSITIVE_INTENTS.has(input.intent)) {
    events.push({
      ...common,
      sourceDomain: "reply",
      signalType: "positive_reply",
      confidence: input.confidence,
      urgency: "high",
      attributionImpacting: false,
      recomputeScope: "full",
      routeActions: ["timeline", "attention"],
      metadata: { intent: input.intent },
    })
  }

  if (NEGATIVE_INTENTS.has(input.intent)) {
    events.push({
      ...common,
      sourceDomain: "reply",
      signalType: "negative_reply",
      confidence: input.confidence,
      urgency: "normal",
      attributionImpacting: false,
      recomputeScope: "full",
      routeActions: ["timeline", "attention"],
      metadata: { intent: input.intent },
    })
  }

  return events
}

export function buildMeetingBookedLeadSignalEvent(input: {
  leadId: string
  meetingId: string
  occurredAt?: string
}): LeadSignalEvent {
  return {
    leadId: input.leadId,
    sourceDomain: "meeting",
    signalType: "meeting_booked",
    confidence: 0.9,
    urgency: "high",
    evidenceRef: { table: "meetings", id: input.meetingId },
    attributionImpacting: true,
    recomputeScope: "full",
    routeActions: ["timeline", "attribution_touch", "attention"],
    occurredAt: input.occurredAt,
    metadata: { meeting_id: input.meetingId },
  }
}

export function buildMeetingCompletedLeadSignalEvent(input: {
  leadId: string
  meetingId: string
  occurredAt?: string
}): LeadSignalEvent {
  return {
    leadId: input.leadId,
    sourceDomain: "meeting",
    signalType: "meeting_completed",
    confidence: 0.92,
    urgency: "high",
    evidenceRef: { table: "meetings", id: input.meetingId },
    attributionImpacting: false,
    recomputeScope: "full",
    routeActions: ["timeline", "attention", "queue_hint"],
    occurredAt: input.occurredAt,
    metadata: { meeting_id: input.meetingId },
  }
}

export function buildMeetingNoShowLeadSignalEvent(input: {
  leadId: string
  meetingId: string
  occurredAt?: string
}): LeadSignalEvent {
  return {
    leadId: input.leadId,
    sourceDomain: "meeting",
    signalType: "meeting_no_show",
    confidence: 0.85,
    urgency: "normal",
    evidenceRef: { table: "meetings", id: input.meetingId },
    attributionImpacting: false,
    recomputeScope: "full",
    routeActions: ["timeline", "attention"],
    occurredAt: input.occurredAt,
    metadata: { meeting_id: input.meetingId },
  }
}

export function buildOpportunityCreatedLeadSignalEvent(input: {
  leadId: string
  opportunityId: string
  occurredAt?: string
}): LeadSignalEvent {
  return {
    leadId: input.leadId,
    sourceDomain: "opportunity",
    signalType: "opportunity_created",
    confidence: 0.95,
    urgency: "urgent",
    evidenceRef: { table: "opportunities", id: input.opportunityId },
    attributionImpacting: false,
    recomputeScope: "full",
    routeActions: ["timeline", "attention"],
    occurredAt: input.occurredAt,
    metadata: { opportunity_id: input.opportunityId },
  }
}

export function buildOpportunityStageAdvancedLeadSignalEvent(input: {
  leadId: string
  opportunityId: string
  fromStage: string
  toStage: string
  occurredAt?: string
}): LeadSignalEvent {
  return {
    leadId: input.leadId,
    sourceDomain: "opportunity",
    signalType: "stage_advanced",
    confidence: 0.8,
    urgency: "high",
    evidenceRef: { table: "opportunities", id: input.opportunityId },
    attributionImpacting: false,
    recomputeScope: "full",
    routeActions: ["timeline", "attention"],
    occurredAt: input.occurredAt,
    metadata: {
      opportunity_id: input.opportunityId,
      from_stage: input.fromStage,
      to_stage: input.toStage,
    },
  }
}

export function buildDealWonLeadSignalEvent(input: {
  leadId: string
  opportunityId: string
  amount?: number
  occurredAt?: string
}): LeadSignalEvent {
  return {
    leadId: input.leadId,
    sourceDomain: "opportunity",
    signalType: "deal_won",
    confidence: 1,
    urgency: "urgent",
    evidenceRef: { table: "opportunities", id: input.opportunityId },
    attributionImpacting: false,
    recomputeScope: "full",
    routeActions: ["timeline", "attention"],
    occurredAt: input.occurredAt,
    metadata: { opportunity_id: input.opportunityId, amount: input.amount ?? null },
  }
}

export function buildDealLostLeadSignalEvent(input: {
  leadId: string
  opportunityId: string
  lossReason?: string | null
  occurredAt?: string
}): LeadSignalEvent {
  return {
    leadId: input.leadId,
    sourceDomain: "opportunity",
    signalType: "deal_lost",
    confidence: 0.9,
    urgency: "normal",
    evidenceRef: { table: "opportunities", id: input.opportunityId },
    attributionImpacting: false,
    recomputeScope: "full",
    routeActions: ["timeline", "attention"],
    occurredAt: input.occurredAt,
    metadata: { opportunity_id: input.opportunityId, loss_reason: input.lossReason ?? null },
  }
}
