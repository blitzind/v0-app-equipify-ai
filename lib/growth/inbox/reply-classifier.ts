/** Deterministic reply classification. Client-safe. No AI. */

import { extractReplySignals, type ReplySignalFlags } from "@/lib/growth/inbox/reply-signals"
import type { GrowthInboxClassification } from "@/lib/growth/inbox/inbox-types"

export type ReplyClassificationResult = {
  classification: GrowthInboxClassification
  confidence: number
  signals: ReplySignalFlags
}

function confidenceForMatch(matched: boolean, strong = false): number {
  if (!matched) return 0
  return strong ? 90 : 75
}

export function classifyReply(input: { subject?: string; body?: string }): ReplyClassificationResult {
  const signals = extractReplySignals(input)

  if (signals.contains_unsubscribe) {
    return { classification: "unsubscribe", confidence: confidenceForMatch(true, true), signals }
  }
  if (signals.contains_competitor) {
    return { classification: "competitor", confidence: confidenceForMatch(true), signals }
  }
  if (signals.contains_meeting_language) {
    return { classification: "meeting_intent", confidence: confidenceForMatch(true, true), signals }
  }
  if (signals.contains_budget || signals.contains_pricing) {
    return { classification: "budget", confidence: confidenceForMatch(true), signals }
  }
  if (signals.contains_timeline) {
    return { classification: "timeline", confidence: confidenceForMatch(true), signals }
  }
  if (signals.contains_positive_signal) {
    return { classification: "positive_interest", confidence: confidenceForMatch(true, true), signals }
  }
  if (signals.contains_referral) {
    return { classification: "referral", confidence: confidenceForMatch(true), signals }
  }
  if (signals.contains_question) {
    return { classification: "question", confidence: 60, signals }
  }

  return { classification: "unknown", confidence: 30, signals }
}

export function classificationLabel(classification: GrowthInboxClassification): string {
  switch (classification) {
    case "positive_interest":
      return "Positive interest"
    case "meeting_intent":
      return "Meeting intent"
    case "budget":
      return "Budget"
    case "timeline":
      return "Timeline"
    case "competitor":
      return "Competitor"
    case "unsubscribe":
      return "Unsubscribe"
    case "not_interested":
      return "Not interested"
    case "question":
      return "Question"
    case "referral":
      return "Referral"
    case "unknown":
      return "Unknown"
  }
}
