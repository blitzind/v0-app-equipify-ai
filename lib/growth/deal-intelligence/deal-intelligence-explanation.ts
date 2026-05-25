import type {
  DealIntelligenceOperatorAction,
  DealIntelligenceRiskLevel,
  DealIntelligenceScoreInputs,
  DealIntelligenceSignalLabel,
} from "@/lib/growth/deal-intelligence/deal-intelligence-types"
import { DEAL_OPERATOR_ACTION_LABELS } from "@/lib/growth/deal-intelligence/deal-intelligence-types"

export function buildDealIntelligenceExplanation(input: {
  companyName: string
  closeProbability: number
  riskLevel: DealIntelligenceRiskLevel
  recommendedOperatorAction: DealIntelligenceOperatorAction
  positiveSignals: DealIntelligenceSignalLabel[]
  riskFactors: DealIntelligenceSignalLabel[]
  scoreInputs: DealIntelligenceScoreInputs
}): string {
  const positives = input.positiveSignals.slice(0, 2).map((signal) => signal.label)
  const risks = input.riskFactors.slice(0, 2).map((factor) => factor.label)
  const actionLabel = DEAL_OPERATOR_ACTION_LABELS[input.recommendedOperatorAction]

  const parts: string[] = [
    `${input.companyName} has a ${input.closeProbability}% close probability with ${input.riskLevel.replace(/_/g, " ")} revenue risk.`,
  ]

  if (positives.length > 0) parts.push(`Positive signals: ${positives.join("; ")}.`)
  if (risks.length > 0) parts.push(`Risk factors: ${risks.join("; ")}.`)
  parts.push(`Recommended operator action: ${actionLabel}. Human approval required — no autonomous CRM movement.`)

  if (input.scoreInputs.meetingsCompleted && input.scoreInputs.repliesReceived) {
    parts.push("Meeting plus reply activity supports momentum.")
  }

  return parts.join(" ")
}
