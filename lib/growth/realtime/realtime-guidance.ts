import { discoveryGapMessages } from "@/lib/growth/realtime/realtime-discovery"
import type {
  GrowthLeadRealtimeIntelligenceInput,
  GrowthRealtimeDetectedBuyingSignal,
  GrowthRealtimeDetectedObjection,
  GrowthRealtimeDiscoveryCoverage,
  GrowthRealtimeGuidanceTip,
  GrowthRealtimeRiskFlag,
} from "@/lib/growth/realtime/realtime-call-types"

export function buildRealtimeGuidance(input: {
  lead: GrowthLeadRealtimeIntelligenceInput
  discovery: GrowthRealtimeDiscoveryCoverage
  objections: GrowthRealtimeDetectedObjection[]
  buyingSignals: GrowthRealtimeDetectedBuyingSignal[]
  riskFlags: GrowthRealtimeRiskFlag[]
}): {
  tips: GrowthRealtimeGuidanceTip[]
  recommendedNextQuestion: string | null
  recommendedResponse: string | null
} {
  const tips: GrowthRealtimeGuidanceTip[] = []

  if (input.lead.decisionMakerStatus === "missing" || input.lead.decisionMakerStatus === "unknown") {
    tips.push({
      id: "dm-not-confirmed",
      message: "Decision maker not confirmed — ask who else needs to weigh in.",
      priority: "high",
    })
  }

  if (input.discovery.missing.includes("timeline_asked")) {
    tips.push({ id: "timeline", message: "Ask implementation timeline.", priority: "medium" })
  }

  if (input.discovery.missing.includes("budget_asked")) {
    tips.push({ id: "budget", message: "Budget discussion not covered yet.", priority: "medium" })
  }

  if (input.buyingSignals.some((signal) => signal.key === "timeline_urgency" || signal.key === "commitment_language")) {
    tips.push({ id: "buying-intent", message: "Buying intent strengthening — propose a concrete next step.", priority: "high" })
  }

  if (input.objections.some((objection) => objection.key === "budget_concern" || objection.key === "pricing_objection")) {
    tips.push({ id: "budget-detected", message: "Budget discussion detected — anchor value before price.", priority: "high" })
  }

  if (input.lead.relationshipTrend === "cooling") {
    tips.push({ id: "relationship", message: "Relationship cooling — prioritize trust-building questions.", priority: "medium" })
  }

  if (input.lead.revenueTrajectory === "at_risk") {
    tips.push({ id: "revenue", message: "Revenue at risk — confirm pain and timeline before ending call.", priority: "high" })
  }

  if (input.lead.executivePriorityTier === "executive_now") {
    tips.push({ id: "executive", message: "Executive account — keep discovery tight and confirm next step.", priority: "high" })
  }

  if (input.riskFlags.includes("talking_too_much")) {
    tips.push({ id: "talk-ratio", message: "Rep talk ratio high — ask an open question and pause.", priority: "high" })
  }

  if (tips.length === 0) {
    tips.push({ id: "steady", message: "Call pacing looks healthy — continue discovery.", priority: "low" })
  }

  const recommendedNextQuestion =
    input.discovery.missing.length > 0
      ? discoveryGapMessages(input.discovery.missing)[0] ?? null
      : input.lead.recommendedSequenceNextStep?.channel
        ? `Confirm next sequence step: ${input.lead.recommendedSequenceNextStep.channel.replace(/_/g, " ")}`
        : "What would make this a priority this quarter?"

  const latestObjection = input.objections[input.objections.length - 1]
  const recommendedResponse = latestObjection
    ? `Acknowledge ${latestObjection.label.toLowerCase()} and ask what success would look like.`
    : input.buyingSignals.length > 0
      ? "Summarize what you heard and propose a specific next step."
      : null

  return { tips, recommendedNextQuestion, recommendedResponse }
}
