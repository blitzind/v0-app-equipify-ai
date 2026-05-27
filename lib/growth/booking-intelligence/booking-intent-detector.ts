import type { GrowthInboxClassification } from "@/lib/growth/inbox/inbox-types"
import { extractReplySignals } from "@/lib/growth/inbox/reply-signals"
import type {
  GrowthBookingEvidenceSnippet,
  GrowthBookingIntentType,
  GrowthBookingSignalConfidence,
} from "@/lib/growth/booking-intelligence/booking-types"
import { sanitizeBookingEvidenceSnippet } from "@/lib/growth/booking-intelligence/booking-types"
import type { GrowthOpportunitySignalType } from "@/lib/growth/opportunity-intelligence/opportunity-types"

export type DetectedBookingIntent = {
  intentType: GrowthBookingIntentType
  confidence: GrowthBookingSignalConfidence
  evidenceSnippet: string
  source: string
}

function snippetFromInput(input: { subject?: string; body?: string }): string {
  const combined = `${input.subject ?? ""} ${input.body ?? ""}`.trim()
  return sanitizeBookingEvidenceSnippet(combined || "Inbound activity detected.")
}

export function detectBookingIntentFromInbox(input: {
  subject?: string
  body?: string
  classification: GrowthInboxClassification
  source?: string
}): DetectedBookingIntent[] {
  const signals = extractReplySignals(input)
  const evidence = snippetFromInput(input)
  const source = input.source ?? "inbox_classifier"
  const detected: DetectedBookingIntent[] = []

  const push = (intentType: GrowthBookingIntentType, confidence: GrowthBookingSignalConfidence, snippet?: string) => {
    detected.push({
      intentType,
      confidence,
      evidenceSnippet: sanitizeBookingEvidenceSnippet(snippet ?? evidence),
      source,
    })
  }

  if (input.classification === "meeting_intent" || signals.contains_meeting_language) {
    push("meeting_request", signals.contains_meeting_language ? "high" : "medium")
    if (/\bdemo\b|\bwalkthrough\b|\btour\b/i.test(evidence)) push("demo_request", "high")
  }
  if (input.classification === "positive_interest" && signals.contains_meeting_language) {
    push("follow_up_call", "medium")
  }
  if (input.classification === "budget" || signals.contains_budget || signals.contains_pricing) {
    push("pricing_call", "high")
  }
  if (input.classification === "timeline" || signals.contains_timeline) {
    push("follow_up_call", "medium")
  }
  if (input.classification === "question" || signals.contains_question) {
    push("technical_call", "low")
  }
  if (signals.contains_referral) {
    push("referral_intro", "medium")
  }
  if (/\bceo\b|\bcto\b|\bvp\b|\bdirector\b|\bhead of\b/i.test(evidence)) {
    push("decision_maker_call", "high")
  }

  const unique = new Map<GrowthBookingIntentType, DetectedBookingIntent>()
  for (const intent of detected) {
    const existing = unique.get(intent.intentType)
    if (!existing || rankConfidence(intent.confidence) > rankConfidence(existing.confidence)) {
      unique.set(intent.intentType, intent)
    }
  }
  return [...unique.values()]
}

export function detectBookingIntentFromOpportunitySignals(
  signals: Array<{ signalType: GrowthOpportunitySignalType; evidenceSnippet: string; source?: string }>,
): DetectedBookingIntent[] {
  const detected: DetectedBookingIntent[] = []
  for (const signal of signals) {
    switch (signal.signalType) {
      case "meeting_interest":
        detected.push({
          intentType: "meeting_request",
          confidence: "high",
          evidenceSnippet: signal.evidenceSnippet,
          source: signal.source ?? "opportunity_intelligence",
        })
        break
      case "pricing_interest":
        detected.push({
          intentType: "pricing_call",
          confidence: "high",
          evidenceSnippet: signal.evidenceSnippet,
          source: signal.source ?? "opportunity_intelligence",
        })
        break
      case "decision_maker_detected":
        detected.push({
          intentType: "decision_maker_call",
          confidence: "high",
          evidenceSnippet: signal.evidenceSnippet,
          source: signal.source ?? "opportunity_intelligence",
        })
        break
      case "proposal_request":
        detected.push({
          intentType: "demo_request",
          confidence: "high",
          evidenceSnippet: signal.evidenceSnippet,
          source: signal.source ?? "opportunity_intelligence",
        })
        break
      case "urgency_signal":
        detected.push({
          intentType: "follow_up_call",
          confidence: "medium",
          evidenceSnippet: signal.evidenceSnippet,
          source: signal.source ?? "opportunity_intelligence",
        })
        break
      default:
        break
    }
  }
  const unique = new Map<GrowthBookingIntentType, DetectedBookingIntent>()
  for (const intent of detected) {
    unique.set(intent.intentType, intent)
  }
  return [...unique.values()]
}

export function detectBookingIntentFromReplyDraftOutcome(input: {
  classification?: GrowthInboxClassification | null
  subject?: string
  body?: string
  draftStatus: "sent" | "approved" | "discarded" | "blocked"
}): DetectedBookingIntent[] {
  if (input.draftStatus !== "sent" || !input.classification) return []
  return detectBookingIntentFromInbox({
    subject: input.subject,
    body: input.body,
    classification: input.classification,
    source: "reply_draft_outcome",
  })
}

function rankConfidence(confidence: GrowthBookingSignalConfidence): number {
  switch (confidence) {
    case "verified":
      return 4
    case "high":
      return 3
    case "medium":
      return 2
    default:
      return 1
  }
}

export function toBookingEvidenceSnippets(intents: DetectedBookingIntent[]): GrowthBookingEvidenceSnippet[] {
  return intents.map((intent) => ({
    source: intent.source,
    snippet: intent.evidenceSnippet,
    intentType: intent.intentType,
    confidence: intent.confidence,
  }))
}

export function hasMinimumBookingEvidence(intents: DetectedBookingIntent[]): boolean {
  return intents.length > 0 && intents.every((intent) => intent.evidenceSnippet.trim().length >= 8)
}
