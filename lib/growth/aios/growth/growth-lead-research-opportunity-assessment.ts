/** GE-AIOS-GROWTH-1B — Opportunity Assessment & Next Best Action (client-safe). */

import type { GrowthLeadResearchResult } from "@/lib/growth/research-types"
import type { GrowthLeadResearchQualificationOutput } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import type { GrowthLeadResearchExecutionPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import {
  GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE,
  GROWTH_EARLY_OUTREACH_MIN_FIT_SCORE,
  assessGrowthResearchSufficiency,
  buildResearchSufficiencyInputFromAssessment,
  hasLikelyDecisionMaker,
  shouldPreferOutreachOverCommitteeResearch,
} from "@/lib/growth/outreach/growth-autonomous-revenue-loop-1a"
import { planGrowthLeadResearchExecution } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import { applyBoundedResearchExecutionPlan } from "@/lib/growth/revenue-workflow/growth-investment-propagation-1b-execution-closure"

export const GROWTH_AIOS_GROWTH_1B_PHASE = "GE-AIOS-GROWTH-1B" as const

export const GROWTH_LEAD_RESEARCH_OPPORTUNITY_ASSESSMENT_QA_MARKER =
  "growth-aios-growth-1b-opportunity-assessment-v1" as const

export const GROWTH_OPPORTUNITY_RECOMMENDATIONS = [
  "pursue_immediately",
  "continue_research",
  "verify_contacts",
  "identify_buying_committee",
  "prepare_outreach",
  "monitor",
  "abandon",
] as const

export type GrowthLeadResearchOpportunityRecommendation =
  (typeof GROWTH_OPPORTUNITY_RECOMMENDATIONS)[number]

export type GrowthLeadResearchOpportunityLevel = "high" | "medium" | "low"

export type GrowthLeadResearchNextBestActionKind =
  | "verify_email"
  | "research_buying_committee"
  | "generate_outreach_draft"
  | "wait_for_buying_signal"
  | "request_human_review"
  | "abandon_lead"
  | "continue_research"

export type GrowthLeadResearchNextBestAction = {
  label: string
  kind: GrowthLeadResearchNextBestActionKind
  reason: string
  priority: GrowthLeadResearchOpportunityLevel
  urgency: GrowthLeadResearchOpportunityLevel
}

export type GrowthLeadResearchEvidenceSummary = {
  verifiedEvidence: string[]
  missingEvidence: string[]
  potentialRisks: string[]
  assumptions: string[]
  humanReviewNotes: string[]
}

export type GrowthLeadResearchOpportunityAssessment = {
  opportunityScore: number
  fitScore: number
  buyingSignalScore: number
  confidence: number
  estimatedRevenueRange: string
  estimatedSalesCycle: string
  urgency: GrowthLeadResearchOpportunityLevel
  effort: GrowthLeadResearchOpportunityLevel
  roiEstimate: GrowthLeadResearchOpportunityLevel
  recommendation: GrowthLeadResearchOpportunityRecommendation
  worthPursuing: boolean
  summary: string
}

export type GrowthLeadResearchIntelligenceOutput = {
  opportunityAssessment: GrowthLeadResearchOpportunityAssessment
  nextBestAction: GrowthLeadResearchNextBestAction
  evidenceSummary: GrowthLeadResearchEvidenceSummary
  executionPlan: GrowthLeadResearchExecutionPlan
}

export const GROWTH_LEAD_RESEARCH_OPPORTUNITY_RUNTIME_RULE =
  "Opportunity Assessment is advisory intelligence only — it never executes outbound, enrolls sequences, or executes Work Orders." as const

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function resolveRevenueRange(result: GrowthLeadResearchResult): string {
  if (result.estimatedAnnualRevenue?.trim()) return result.estimatedAnnualRevenue.trim()
  if (result.fleetSizeEstimate?.trim()) {
    return `$${result.fleetSizeEstimate} fleet — mid-market field service`
  }
  if (result.equipifyFitScore >= 70) return "$250K–$1.2M annual service revenue (estimated)"
  if (result.equipifyFitScore >= 50) return "$100K–$500K annual service revenue (estimated)"
  return "Under $100K or unverified revenue potential"
}

function resolveSalesCycle(result: GrowthLeadResearchResult, opportunityScore: number): string {
  if (opportunityScore >= 75) return "30–60 days"
  if (opportunityScore >= 55) return "60–90 days"
  if (result.companySizeEstimate?.toLowerCase().includes("enterprise")) return "90–120 days"
  return "90+ days or unclear"
}

function resolveBuyingSignalScore(result: GrowthLeadResearchResult): number {
  let score = 20
  score += Math.min(25, result.equipifyPainPoints.length * 8)
  score += Math.min(20, result.outreachAngles.length * 6)
  score += Math.min(15, result.equipmentServiceIndicators.length * 5)
  if (result.fleetSizeEstimate?.trim()) score += 10
  if (result.decisionMakerCandidates.length > 0) score += 10
  if (result.crmDetected?.trim()) score += 5
  return clampScore(score)
}

function resolveEffort(result: GrowthLeadResearchResult): GrowthLeadResearchOpportunityLevel {
  const gaps =
    (result.websiteSummary ? 0 : 1) +
    (result.sourceUrls.length > 0 ? 0 : 1) +
    (result.decisionMakerCandidates.length > 0 ? 0 : 1)
  if (gaps >= 2) return "high"
  if (gaps === 1) return "medium"
  return "low"
}

function resolveRoi(opportunityScore: number, effort: GrowthLeadResearchOpportunityLevel): GrowthLeadResearchOpportunityLevel {
  const effortPenalty = effort === "high" ? 18 : effort === "medium" ? 8 : 0
  const roiScore = opportunityScore - effortPenalty
  if (roiScore >= 65) return "high"
  if (roiScore >= 45) return "medium"
  return "low"
}

function resolveRecommendation(input: {
  opportunityScore: number
  fitScore: number
  buyingSignalScore: number
  confidence: number
  missingEvidenceCount: number
  qualification: GrowthLeadResearchQualificationOutput
  hasLikelyContact: boolean
  result: GrowthLeadResearchResult
  researchTimeBudgetExhausted?: boolean
}): GrowthLeadResearchOpportunityRecommendation {
  if (input.fitScore < 40 || input.opportunityScore < 35) return "abandon"

  const sufficiency = assessGrowthResearchSufficiency(
    buildResearchSufficiencyInputFromAssessment({
      result: input.result,
      qualification: {
        fitScore: input.fitScore,
        recommendedNextAction: input.qualification.recommendedNextAction,
        recommendedWorkOrderType: input.qualification.recommendedWorkOrderType,
        confidence: input.confidence,
        reason: input.qualification.reason,
        missingEvidence: input.qualification.missingEvidence,
      },
      researchTimeBudgetExhausted: input.researchTimeBudgetExhausted,
    }),
  )

  if (sufficiency.decision === "terminal_reject") return "abandon"
  if (sufficiency.decision === "operator_review_required") return "continue_research"
  if (sufficiency.decision === "sufficient_for_supervised_outreach") return "prepare_outreach"
  if (sufficiency.decision === "targeted_research_required") {
    if (
      sufficiency.missingMaterialEvidence.some(
        (gap) => gap !== "confidence_or_fit_threshold",
      )
    ) {
      return "continue_research"
    }
  }

  if (input.missingEvidenceCount >= 4 || input.confidence < 0.4) return "continue_research"
  if (input.missingEvidenceCount >= 2 && input.confidence < GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE) {
    return "continue_research"
  }

  const action = input.qualification.recommendedNextAction.toLowerCase()
  if (action.includes("verify") || action.includes("email")) return "verify_contacts"
  if (
    (action.includes("committee") || action.includes("decision maker")) &&
    !shouldPreferOutreachOverCommitteeResearch({
      qualification: input.qualification,
      hasLikelyContact: input.hasLikelyContact,
    })
  ) {
    return "identify_buying_committee"
  }
  if (action.includes("outreach") || action.includes("email draft")) return "prepare_outreach"
  if (action.includes("monitor") || action.includes("wait")) return "monitor"

  if (input.opportunityScore >= 75 && input.buyingSignalScore >= 60 && input.confidence >= 0.7) {
    return "pursue_immediately"
  }
  if (
    input.opportunityScore >= 55 ||
    (input.confidence >= GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE &&
      input.fitScore >= GROWTH_EARLY_OUTREACH_MIN_FIT_SCORE &&
      input.hasLikelyContact)
  ) {
    return "prepare_outreach"
  }
  if (input.buyingSignalScore < 40) return "continue_research"
  return "monitor"
}

function resolveNextBestAction(
  recommendation: GrowthLeadResearchOpportunityRecommendation,
  qualification: GrowthLeadResearchQualificationOutput,
): GrowthLeadResearchNextBestAction {
  switch (recommendation) {
    case "verify_contacts":
      return {
        label: "Verify Email",
        kind: "verify_email",
        reason: "Contact verification is required before advancing this lead.",
        priority: "high",
        urgency: "medium",
      }
    case "identify_buying_committee":
      return {
        label: "Research Buying Committee",
        kind: "research_buying_committee",
        reason: "Decision makers are not confirmed — map the buying committee first.",
        priority: "high",
        urgency: "medium",
      }
    case "prepare_outreach":
      return {
        label: "Generate Outreach Draft",
        kind: "generate_outreach_draft",
        reason: "Research supports a tailored outreach draft for operator review.",
        priority: "medium",
        urgency: "medium",
      }
    case "pursue_immediately":
      return {
        label: "Generate Outreach Draft",
        kind: "generate_outreach_draft",
        reason: "Strong fit and buying signals — prepare outreach for human approval.",
        priority: "high",
        urgency: "high",
      }
    case "monitor":
      return {
        label: "Wait for Buying Signal",
        kind: "wait_for_buying_signal",
        reason: "Opportunity is promising but timing is not urgent — monitor engagement.",
        priority: "low",
        urgency: "low",
      }
    case "continue_research":
      return {
        label: "Continue Research",
        kind: "continue_research",
        reason: qualification.reason || "Additional research will improve outreach quality — Ava continues autonomously.",
        priority: "medium",
        urgency: "medium",
      }
    case "abandon":
      return {
        label: "Abandon Lead",
        kind: "abandon_lead",
        reason: "Fit and opportunity scores do not justify pursuit at this time.",
        priority: "low",
        urgency: "low",
      }
    default:
      return {
        label: "Continue Research",
        kind: "continue_research",
        reason: qualification.reason || "Ava continues evaluation autonomously.",
        priority: "medium",
        urgency: "medium",
      }
  }
}

function buildEvidenceSummary(input: {
  result: GrowthLeadResearchResult
  qualification: GrowthLeadResearchQualificationOutput
}): GrowthLeadResearchEvidenceSummary {
  const verifiedEvidence: string[] = []
  if (input.result.companySummary.trim()) {
    verifiedEvidence.push(`Company summary: ${input.result.companySummary.slice(0, 120)}`)
  }
  if (input.result.websiteSummary?.trim()) {
    verifiedEvidence.push(`Website summary captured`)
  }
  for (const url of input.result.sourceUrls.slice(0, 4)) {
    verifiedEvidence.push(`Source: ${url}`)
  }
  for (const indicator of input.result.equipmentServiceIndicators.slice(0, 3)) {
    verifiedEvidence.push(`Service indicator: ${indicator}`)
  }
  for (const pain of input.result.equipifyPainPoints.slice(0, 3)) {
    verifiedEvidence.push(`Pain point: ${pain}`)
  }

  const potentialRisks: string[] = []
  if (input.qualification.missingEvidence.length > 0) {
    potentialRisks.push("Material evidence gaps remain")
  }
  if (input.result.researchConfidence < 0.55) {
    potentialRisks.push("Research confidence below operator threshold")
  }
  if (input.result.equipifyFitScore < 55) {
    potentialRisks.push("Fit score below pursuit threshold")
  }
  if (input.result.decisionMakerCandidates.length === 0) {
    potentialRisks.push("No verified decision makers — disclose in package; send remains gated")
  }

  const assumptions: string[] = []
  if (!input.result.estimatedAnnualRevenue) {
    assumptions.push("Revenue range inferred from fit score and fleet signals")
  }
  if (input.result.companySizeEstimate) {
    assumptions.push(`Company size estimate: ${input.result.companySizeEstimate}`)
  }
  assumptions.push(`Fit model ${input.result.fitModelVersion}`)

  const humanReviewNotes: string[] = []
  if (input.qualification.recommendedNextAction) {
    humanReviewNotes.push(`Research suggested: ${input.qualification.recommendedNextAction}`)
  }
  humanReviewNotes.push("Outbound send remains operator-gated — preparation and research continue autonomously.")

  return {
    verifiedEvidence,
    missingEvidence: [...input.qualification.missingEvidence],
    potentialRisks,
    assumptions,
    humanReviewNotes,
  }
}

export function assessGrowthLeadResearchOpportunity(input: {
  result: GrowthLeadResearchResult
  qualification: GrowthLeadResearchQualificationOutput
  leadMetadata?: Record<string, unknown> | null
}): GrowthLeadResearchIntelligenceOutput {
  const fitScore = input.qualification.fitScore
  const confidence = input.qualification.confidence
  const buyingSignalScore = resolveBuyingSignalScore(input.result)
  const opportunityScore = clampScore(
    fitScore * 0.45 + buyingSignalScore * 0.35 + confidence * 100 * 0.2,
  )
  const effort = resolveEffort(input.result)
  const roiEstimate = resolveRoi(opportunityScore, effort)
  const urgency: GrowthLeadResearchOpportunityLevel =
    opportunityScore >= 75 ? "high" : opportunityScore >= 50 ? "medium" : "low"

  const recommendation = resolveRecommendation({
    opportunityScore,
    fitScore,
    buyingSignalScore,
    confidence,
    missingEvidenceCount: input.qualification.missingEvidence.length,
    qualification: input.qualification,
    hasLikelyContact: hasLikelyDecisionMaker({ result: input.result }),
    result: input.result,
  })

  const worthPursuing =
    recommendation !== "abandon" &&
    recommendation !== "monitor" &&
    opportunityScore >= 50 &&
    fitScore >= 55

  const summary = worthPursuing
    ? `Worth pursuing — opportunity score ${opportunityScore} with ${recommendation.replaceAll("_", " ")}.`
    : recommendation === "abandon"
      ? `Stop pursuit — opportunity score ${opportunityScore} and fit ${fitScore} are too low.`
      : `Review before advancing — opportunity score ${opportunityScore}; recommendation ${recommendation.replaceAll("_", " ")}.`

  const opportunityAssessment: GrowthLeadResearchOpportunityAssessment = {
    opportunityScore,
    fitScore,
    buyingSignalScore,
    confidence,
    estimatedRevenueRange: resolveRevenueRange(input.result),
    estimatedSalesCycle: resolveSalesCycle(input.result, opportunityScore),
    urgency,
    effort,
    roiEstimate,
    recommendation,
    worthPursuing,
    summary,
  }

  const evidenceSummary = buildEvidenceSummary(input)

  const nextBestAction = resolveNextBestAction(recommendation, input.qualification)

  const executionPlan = applyBoundedResearchExecutionPlan({
    metadata: input.leadMetadata ?? null,
    executionPlan: planGrowthLeadResearchExecution({
      nextBestAction,
      opportunityAssessment,
      evidenceSummary,
      qualification: input.qualification,
    }),
  })

  return {
    opportunityAssessment,
    nextBestAction,
    evidenceSummary,
    executionPlan,
  }
}
