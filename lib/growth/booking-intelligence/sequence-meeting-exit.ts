import type { DetectedBookingIntent } from "@/lib/growth/booking-intelligence/booking-intent-detector"

export type SequenceMeetingExitCandidateDraft = {
  reason: string
  evidenceSnippet: string
}

const EXIT_INTENTS = new Set([
  "meeting_request",
  "demo_request",
  "decision_maker_call",
  "pricing_call",
])

export function detectSequenceMeetingExitCandidates(input: {
  intents: DetectedBookingIntent[]
  hasActiveSequence: boolean
}): SequenceMeetingExitCandidateDraft[] {
  if (!input.hasActiveSequence) return []

  return input.intents
    .filter((intent) => EXIT_INTENTS.has(intent.intentType))
    .map((intent) => ({
      reason: `Sequence stop/pause review recommended — ${intent.intentType.replace(/_/g, " ")} detected while sequence is active.`,
      evidenceSnippet: intent.evidenceSnippet,
    }))
}

export function hasMeetingIntentForSequenceBadge(intents: DetectedBookingIntent[]): boolean {
  return intents.some((intent) => EXIT_INTENTS.has(intent.intentType))
}
