import type {
  CallIntelligenceExtractedSignals,
  CallIntelligenceOutcome,
  CallIntelligenceRiskLevel,
} from "@/lib/growth/call-intelligence/call-intelligence-types"
import type { ComputedCallIntelligenceScore } from "@/lib/growth/call-intelligence/call-score-engine"

export function buildCallIntelligenceSafeSummary(input: {
  companyName: string
  computed: ComputedCallIntelligenceScore
  signals: CallIntelligenceExtractedSignals
  riskLevel: CallIntelligenceRiskLevel
  outcome: CallIntelligenceOutcome
}): string {
  if (input.computed.metrics.incomplete) {
    return `Insufficient call data for ${input.companyName}. Complete a live coaching session with transcript activity, then recompute.`
  }

  const positives = input.signals.buyingSignals.slice(0, 2).map((signal) => signal.label)
  const coaching = input.signals.coachingOpportunities.slice(0, 2).map((item) => item.label)
  const parts = [
    `${input.companyName} call scored ${input.computed.overallScore}/100 with ${input.riskLevel.replace(/_/g, " ")} coaching risk and ${input.outcome} outcome.`,
  ]
  if (positives.length) parts.push(`Positive signals: ${positives.join("; ")}.`)
  if (coaching.length) parts.push(`Coaching opportunities: ${coaching.join("; ")}.`)
  parts.push(`Recommended: ${input.computed.recommendedNextAction}. Human approval required — no autonomous CRM movement or sends.`)
  return parts.join(" ")
}
