import type {
  GrowthRevenueCopilotAssist,
} from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase6-types"
import { GROWTH_REVENUE_INTELLIGENCE_QA_MARKER } from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase6-types"
import type { BuyingMomentumResult } from "@/lib/growth/revenue-intelligence/buying-momentum-engine"
import type { DetectedRevenueOpportunitySignal } from "@/lib/growth/revenue-intelligence/opportunity-signal-engine"

/** Deterministic revenue intelligence copilot — labeled AI-assisted, no autonomous execution. */
export function buildRevenueIntelligenceCopilot(input: {
  companyLabel: string
  momentum: BuyingMomentumResult
  signals: DetectedRevenueOpportunitySignal[]
  objectionCategories: string[]
  committeeCompleteness: number
  missingStakeholders: string[]
  recommendedOperatorAction?: string | null
}): GrowthRevenueCopilotAssist {
  const evidenceExcerpts = [
    ...input.momentum.evidence,
    ...input.signals.map((s) => s.excerpt),
  ].filter(Boolean).slice(0, 8)

  const missingInformation: string[] = []
  if (input.committeeCompleteness < 50) missingInformation.push("Buying committee map incomplete — verify stakeholders.")
  if (input.objectionCategories.length > 0) {
    missingInformation.push(`Unresolved objections: ${input.objectionCategories.join(", ")}.`)
  }
  if (input.signals.length === 0) missingInformation.push("Limited opportunity signals — gather more evidence before advancing.")

  const followUpPriorities: string[] = []
  if (input.signals.some((s) => s.signalType === "demo_request")) followUpPriorities.push("Confirm demo scheduling with operator review.")
  if (input.signals.some((s) => s.signalType === "pricing_interest")) followUpPriorities.push("Prepare pricing response draft for human approval.")
  if (input.momentum.momentumTrend === "stalled") followUpPriorities.push("Review stalled conversation — consider human touch or pause sequence.")
  if (followUpPriorities.length === 0) followUpPriorities.push("Monitor momentum — no high-confidence next step without operator judgment.")

  return {
    qaMarker: GROWTH_REVENUE_INTELLIGENCE_QA_MARKER,
    assistedLabel: "AI-assisted",
    accountSummary: `${input.companyLabel}: momentum ${input.momentum.momentumScore}/100 (${input.momentum.momentumTrend}), ${input.signals.length} opportunity signal(s).`,
    momentumSummary: input.momentum.explainability.join(" "),
    objectionSummary:
      input.objectionCategories.length > 0
        ? `Objections detected: ${input.objectionCategories.join(", ")}.`
        : "No major objection categories detected in latest evidence.",
    missingInformation,
    suggestedNextAction:
      input.recommendedOperatorAction ??
      "Review evidence-backed signals and confirm next step manually — no autonomous deal progression.",
    stakeholderActivitySummary:
      input.missingStakeholders.length > 0
        ? `Committee completeness ${input.committeeCompleteness}%. Gaps: ${input.missingStakeholders.slice(0, 2).join(" ")}`
        : `Committee completeness ${input.committeeCompleteness}% based on detected stakeholder evidence.`,
    followUpPriorities,
    evidenceExcerpts,
    confidenceNote:
      input.signals.length >= 2 && input.momentum.momentumScore >= 55
        ? "Moderate confidence from multiple evidence sources — operator should verify."
        : "Low confidence — insufficient evidence for strong revenue conclusions.",
  }
}
