import type { GrowthOpportunitySignalType } from "@/lib/growth/opportunity-intelligence/opportunity-types"
import type { DetectedOpportunitySignal } from "@/lib/growth/opportunity-intelligence/signal-detector"

export type SequencePauseCandidateDraft = {
  reason: string
  signalType: GrowthOpportunitySignalType | null
  evidenceSnippet: string
}

const PAUSE_SIGNALS: GrowthOpportunitySignalType[] = [
  "meeting_interest",
  "proposal_request",
  "budget_signal",
  "competitive_signal",
  "urgency_signal",
]

export function detectSequencePauseCandidates(input: {
  signals: DetectedOpportunitySignal[]
  hasActiveSequence: boolean
}): SequencePauseCandidateDraft[] {
  if (!input.hasActiveSequence) return []

  return input.signals
    .filter((signal) => PAUSE_SIGNALS.includes(signal.signalType))
    .map((signal) => ({
      reason: `Pause recommended due to ${signal.signalType.replace(/_/g, " ")} while sequence is active.`,
      signalType: signal.signalType,
      evidenceSnippet: signal.evidenceSnippet,
    }))
}

export function detectStopSequenceCandidate(input: {
  signals: DetectedOpportunitySignal[]
  hasActiveSequence: boolean
}): SequencePauseCandidateDraft | null {
  if (!input.hasActiveSequence) return null
  const competitive = input.signals.find((signal) => signal.signalType === "competitive_signal")
  if (!competitive) return null
  return {
    reason: "Stop sequence recommended — competitive evaluation language detected.",
    signalType: "competitive_signal",
    evidenceSnippet: competitive.evidenceSnippet,
  }
}
