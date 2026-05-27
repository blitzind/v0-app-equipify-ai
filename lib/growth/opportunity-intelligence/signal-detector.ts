import type { GrowthInboxClassification } from "@/lib/growth/inbox/inbox-types"
import { extractReplySignals } from "@/lib/growth/inbox/reply-signals"
import type {
  GrowthOpportunityEvidenceSnippet,
  GrowthOpportunitySignalConfidence,
  GrowthOpportunitySignalType,
} from "@/lib/growth/opportunity-intelligence/opportunity-types"
import { sanitizeEvidenceSnippet } from "@/lib/growth/opportunity-intelligence/opportunity-types"

export type DetectedOpportunitySignal = {
  signalType: GrowthOpportunitySignalType
  confidence: GrowthOpportunitySignalConfidence
  evidenceSnippet: string
  source: string
}

function snippetFromInput(input: { subject?: string; body?: string }): string {
  const combined = `${input.subject ?? ""} ${input.body ?? ""}`.trim()
  return sanitizeEvidenceSnippet(combined || "Inbound activity detected.")
}

export function detectOpportunitySignalsFromInbox(input: {
  subject?: string
  body?: string
  classification: GrowthInboxClassification
  source?: string
}): DetectedOpportunitySignal[] {
  const signals = extractReplySignals(input)
  const evidence = snippetFromInput(input)
  const source = input.source ?? "inbox_classifier"
  const detected: DetectedOpportunitySignal[] = []

  const push = (
    signalType: GrowthOpportunitySignalType,
    confidence: GrowthOpportunitySignalConfidence,
    snippet?: string,
  ) => {
    detected.push({
      signalType,
      confidence,
      evidenceSnippet: sanitizeEvidenceSnippet(snippet ?? evidence),
      source,
    })
  }

  if (input.classification === "meeting_intent" || signals.contains_meeting_language) {
    push("meeting_interest", signals.contains_meeting_language ? "high" : "medium")
  }
  if (input.classification === "budget" || signals.contains_budget) {
    push("budget_signal", "high")
    if (signals.contains_pricing) push("pricing_interest", "high")
  }
  if (input.classification === "timeline" || signals.contains_timeline) {
    push("timeline_interest", "medium")
  }
  if (signals.contains_competitor || input.classification === "competitor") {
    push("competitive_signal", "medium")
  }
  if (signals.contains_question) {
    push("technical_validation", "low")
  }
  if (signals.contains_positive_signal || input.classification === "positive_interest") {
    push("urgency_signal", "medium")
  }
  if (/\bproposal\b|\brfp\b|\bquote\b|\bsow\b/i.test(evidence)) {
    push("proposal_request", "high")
  }
  if (signals.contains_referral) {
    push("decision_maker_detected", "medium")
    push("committee_detected", "medium")
  }
  if (/\bceo\b|\bcto\b|\bvp\b|\bdirector\b|\bhead of\b/i.test(evidence)) {
    push("decision_maker_detected", "high")
  }
  if (/\bteam\b|\bcommittee\b|\bstakeholder\b|\bwe need\b/i.test(evidence)) {
    push("committee_detected", "medium")
  }

  const unique = new Map<GrowthOpportunitySignalType, DetectedOpportunitySignal>()
  for (const signal of detected) {
    const existing = unique.get(signal.signalType)
    if (!existing || rankConfidence(signal.confidence) > rankConfidence(existing.confidence)) {
      unique.set(signal.signalType, signal)
    }
  }
  return [...unique.values()]
}

function rankConfidence(confidence: GrowthOpportunitySignalConfidence): number {
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

export function detectOpportunitySignalsFromReplyDraftOutcome(input: {
  classification?: GrowthInboxClassification | null
  subject?: string
  body?: string
  draftStatus: "sent" | "approved" | "discarded" | "blocked"
}): DetectedOpportunitySignal[] {
  if (input.draftStatus !== "sent" || !input.classification) return []
  return detectOpportunitySignalsFromInbox({
    subject: input.subject,
    body: input.body,
    classification: input.classification,
    source: "reply_draft_outcome",
  })
}

export function toEvidenceSnippets(signals: DetectedOpportunitySignal[]): GrowthOpportunityEvidenceSnippet[] {
  return signals.map((signal) => ({
    source: signal.source,
    snippet: signal.evidenceSnippet,
    signalType: signal.signalType,
    confidence: signal.confidence,
  }))
}

export function hasMinimumEvidence(signals: DetectedOpportunitySignal[]): boolean {
  return signals.length > 0 && signals.every((signal) => signal.evidenceSnippet.trim().length >= 8)
}
