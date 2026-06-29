/**
 * GE-LAUNCH-1A — Map closed-loop learning outcomes → IRE email learning observations.
 * Client-safe. Deterministic bridge — no new learning engine.
 */

import type {
  GrowthLearningOutcome,
  GrowthLearningOutcomeType,
} from "@/lib/growth/aios/learning/growth-closed-loop-learning-types"
import {
  buildEmailLearningObservations,
  type EmailLearningEventSource,
  type EmailLearningObservation,
  type EmailLearningObservationInput,
} from "@/lib/growth/contact-verification/email-learning"

export const GROWTH_LEARNING_IRE_BRIDGE_QA_MARKER = "growth-learning-ire-bridge-v1" as const

const OUTCOME_TYPE_MAP: Partial<Record<GrowthLearningOutcomeType, string>> = {
  reply: "replied",
  positive_intent: "positive_reply",
  negative_intent: "negative_reply",
  meeting_booked: "meeting_booked",
  bounce: "bounce_hard",
  unsubscribe: "unsubscribe",
  opt_out: "unsubscribe",
  viewed: "opened",
  clicked: "clicked",
  completed: "delivered",
  failed: "bounce_soft",
  rejected: "manual_rejected",
  approved: "manual_verified",
  converted: "meeting_booked",
  no_response: "sent",
  stalled: "sent",
  cancelled: "unsubscribe",
}

const SOURCE_MAP: Partial<Record<GrowthLearningOutcome["source"], EmailLearningEventSource>> = {
  email: "provider_webhook",
  sms: "compliance",
  call: "reply_intelligence",
  voice_drop: "compliance",
  video: "provider_webhook",
  meeting: "meeting_booked",
  human_approval: "manual_verification",
  customer_lifecycle: "reply_intelligence",
  campaign: "outbound_send",
  sequence: "outbound_send",
  workflow_agent: "reply_intelligence",
  revenue_director: "reply_intelligence",
  autonomous_outbound: "outbound_send",
}

function evidenceValue(
  outcome: GrowthLearningOutcome,
  keys: string[],
): string | null {
  for (const item of outcome.evidence) {
    const label = String(item.label ?? "").toLowerCase()
    if (keys.some((key) => label.includes(key))) {
      const value = String(item.value ?? "").trim()
      if (value) return value
    }
  }
  return null
}

function resolveOutcomeEmail(outcome: GrowthLearningOutcome): string | null {
  const related = outcome.related as Record<string, unknown>
  const dimensions = outcome.dimensions as Record<string, unknown>
  const fromEvidence = evidenceValue(outcome, ["email", "recipient"])
  if (fromEvidence?.includes("@")) return fromEvidence.toLowerCase()

  const candidate =
    (typeof related.email === "string" ? related.email : null) ??
    (typeof dimensions.email === "string" ? dimensions.email : null)
  return candidate?.trim().toLowerCase() ?? null
}

export function mapClosedLoopLearningOutcomeToEmailObservationInput(
  outcome: GrowthLearningOutcome,
): EmailLearningObservationInput | null {
  const mappedOutcome = OUTCOME_TYPE_MAP[outcome.outcomeType]
  if (!mappedOutcome) return null

  const source = SOURCE_MAP[outcome.source] ?? "compliance"
  const email = resolveOutcomeEmail(outcome)

  return {
    email,
    organizationId: outcome.organizationId,
    contactId:
      outcome.subject.type === "person"
        ? outcome.subject.id
        : outcome.subject.type === "lead"
          ? outcome.subject.id
          : null,
    campaignId: outcome.related.campaignId ?? null,
    sequenceId: outcome.related.sequenceId ?? null,
    outcome: mappedOutcome,
    eventTimestamp: outcome.occurredAt,
    source,
    dedupeKey: outcome.id,
    metadata: {
      qa_marker: GROWTH_LEARNING_IRE_BRIDGE_QA_MARKER,
      learning_outcome_id: outcome.id,
      learning_outcome_type: outcome.outcomeType,
      learning_source: outcome.source,
      signal_strength: outcome.signalStrength,
      channel: outcome.dimensions.channel ?? null,
    },
  }
}

export function mapClosedLoopLearningOutcomesToEmailObservations(
  outcomes: readonly GrowthLearningOutcome[],
): EmailLearningObservation[] {
  const inputs = outcomes
    .map(mapClosedLoopLearningOutcomeToEmailObservationInput)
    .filter((row): row is EmailLearningObservationInput => row != null)
  return buildEmailLearningObservations(inputs)
}

export function filterEmailLearningObservations(input: {
  observations: readonly EmailLearningObservation[]
  organizationId?: string | null
  leadId?: string | null
  domain?: string | null
  email?: string | null
}): EmailLearningObservation[] {
  const normalizedDomain = input.domain?.replace(/^www\./, "").toLowerCase() ?? null
  const normalizedEmail = input.email?.trim().toLowerCase() ?? null
  const leadId = input.leadId?.trim() ?? null

  return input.observations.filter((row) => {
    if (input.organizationId && row.organization_id && row.organization_id !== input.organizationId) {
      return false
    }
    if (normalizedEmail && row.normalized_email && row.normalized_email !== normalizedEmail) {
      return false
    }
    if (normalizedDomain && row.domain && row.domain !== normalizedDomain) {
      return false
    }
    if (leadId && row.contact_id && row.contact_id !== leadId) {
      return false
    }
    return true
  })
}

export function mergeHistoricalLearningObservations(
  globalObservations: readonly EmailLearningObservation[],
  scopedObservations: readonly EmailLearningObservation[],
): EmailLearningObservation[] {
  const seen = new Set<string>()
  const merged: EmailLearningObservation[] = []

  for (const row of [...scopedObservations, ...globalObservations]) {
    const key = row.observation_id
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(row)
  }

  return merged
}
