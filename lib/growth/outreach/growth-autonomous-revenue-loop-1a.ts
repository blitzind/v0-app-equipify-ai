/** GE-AIOS-OUTREACH-1A — Autonomous revenue loop: research enables outreach, not the destination. */

import type { GrowthLeadResearchQualificationOutput } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import type { GrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import type { GrowthLeadResearchResult } from "@/lib/growth/research-types"
import type { GrowthResearchRunPublicView } from "@/lib/growth/research/research-types"
import {
  assessGrowthResearchSufficiency,
  isPackageReadyFromSufficiency,
  shouldStopResearchFromSufficiency,
  type GrowthResearchSufficiencyInput,
} from "@/lib/growth/research/growth-research-sufficiency-1a"
import type { GrowthLead } from "@/lib/growth/types"

export const GROWTH_AUTONOMOUS_REVENUE_LOOP_1A_QA_MARKER =
  "ge-aios-outreach-1a-autonomous-revenue-loop-v1" as const

/** Good-enough qualification threshold — exit research and begin outreach prep. */
export const GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE = 0.5 as const

/** Minimum fit to pursue early outreach after research. */
export const GROWTH_EARLY_OUTREACH_MIN_FIT_SCORE = 55 as const

/** Max missing evidence items before research must continue (obvious disqualifier path). */
export const GROWTH_RESEARCH_EXIT_MAX_MISSING_EVIDENCE = 3 as const

export {
  assessGrowthResearchSufficiency,
  assessGrowthResearchSufficiencyFromLead,
  buildResearchSufficiencyInputFromAssessment,
  GROWTH_RESEARCH_SUFFICIENCY_1A_QA_MARKER,
  GROWTH_RESEARCH_SUFFICIENCY_MAX_TARGETED_PASSES,
  hasFirstPartyOperationalEvidence,
  isPackageReadyFromSufficiency,
  isSendReadyFromSufficiency,
  providerClassificationConflictsWithFirstPartyEvidence,
  shouldStopResearchFromSufficiency,
  type GrowthResearchSufficiencyDecision,
  type GrowthResearchSufficiencyInput,
} from "@/lib/growth/research/growth-research-sufficiency-1a"

const LIKELY_DM_STATUSES = new Set([
  "confirmed",
  "verified_contactable",
  "suspected",
])

export function hasLikelyDecisionMaker(input: {
  lead?: Pick<GrowthLead, "decisionMakerStatus" | "primaryDecisionMakerId" | "contactName"> | null
  result?: Pick<GrowthLeadResearchResult, "decisionMakerCandidates"> | null
}): boolean {
  const lead = input.lead
  if (lead?.primaryDecisionMakerId?.trim()) return true
  if (lead?.contactName?.trim()) return true
  if (lead?.decisionMakerStatus && LIKELY_DM_STATUSES.has(lead.decisionMakerStatus)) return true
  if ((input.result?.decisionMakerCandidates.length ?? 0) > 0) return true
  return false
}

export function isObviousDisqualifier(input: {
  fitScore: number
  confidence: number
  missingEvidenceCount: number
}): boolean {
  return input.fitScore < 40 || input.missingEvidenceCount >= 4 || input.confidence < 0.35
}

export function hasEnoughWebsiteEvidence(result: Pick<
  GrowthLeadResearchResult,
  "companySummary" | "websiteSummary" | "sourceUrls"
>): boolean {
  const hasSummary = Boolean(result.companySummary.trim())
  const hasWebsite = Boolean(result.websiteSummary?.trim())
  const hasSources = result.sourceUrls.length > 0
  return hasSummary && (hasWebsite || hasSources)
}

function toSufficiencyInput(input: {
  fitScore: number
  confidence: number
  missingEvidenceCount: number
  result?: Pick<
    GrowthLeadResearchResult,
    | "companySummary"
    | "websiteSummary"
    | "sourceUrls"
    | "decisionMakerCandidates"
    | "outreachAngles"
    | "equipmentServiceIndicators"
    | "equipifyPainPoints"
  > | null
  lead?: Pick<
    GrowthLead,
    | "decisionMakerStatus"
    | "primaryDecisionMakerId"
    | "contactName"
    | "contactEmail"
    | "country"
    | "metadata"
  > | null
  researchTimeBudgetExhausted?: boolean
}): GrowthResearchSufficiencyInput {
  return {
    fitScore: input.fitScore,
    confidence: input.confidence,
    missingEvidenceCount: input.missingEvidenceCount,
    result: input.result ?? null,
    lead: input.lead ?? null,
    researchTimeBudgetExhausted: input.researchTimeBudgetExhausted,
  }
}

/** Research should stop — advance toward outreach prep (draft factory / approval queue). */
export function isResearchCompleteForOutreach(input: {
  fitScore: number
  confidence: number
  missingEvidenceCount: number
  result?: Pick<
    GrowthLeadResearchResult,
    | "companySummary"
    | "websiteSummary"
    | "sourceUrls"
    | "decisionMakerCandidates"
    | "outreachAngles"
    | "equipmentServiceIndicators"
    | "equipifyPainPoints"
  > | null
  lead?: Pick<
    GrowthLead,
    | "decisionMakerStatus"
    | "primaryDecisionMakerId"
    | "contactName"
    | "contactEmail"
    | "country"
    | "metadata"
  > | null
  researchTimeBudgetExhausted?: boolean
}): boolean {
  return shouldStopResearchFromSufficiency(assessGrowthResearchSufficiency(toSufficiencyInput(input)))
}

/** Package-ready for supervised outreach — decision maker not required. */
export function isGoodEnoughForEarlyOutreach(input: {
  fitScore: number
  confidence: number
  missingEvidenceCount: number
  result?: Pick<
    GrowthLeadResearchResult,
    | "companySummary"
    | "websiteSummary"
    | "sourceUrls"
    | "decisionMakerCandidates"
    | "outreachAngles"
    | "equipmentServiceIndicators"
    | "equipifyPainPoints"
  > | null
  lead?: Pick<
    GrowthLead,
    | "decisionMakerStatus"
    | "primaryDecisionMakerId"
    | "contactName"
    | "contactEmail"
    | "country"
    | "metadata"
  > | null
  researchTimeBudgetExhausted?: boolean
}): boolean {
  return isPackageReadyFromSufficiency(assessGrowthResearchSufficiency(toSufficiencyInput(input)))
}

export function isGoodEnoughForEarlyOutreachFromRun(
  run: Pick<GrowthResearchRunPublicView, "researchConfidence" | "websiteMaturityScore">,
): boolean {
  const raw = run.researchConfidence ?? 0
  const confidence = raw <= 1 ? raw : raw / 100
  if (confidence < GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE) return false
  const maturity = run.websiteMaturityScore ?? raw
  const fitProxy = maturity <= 1 ? maturity * 100 : maturity
  return isGoodEnoughForEarlyOutreach({
    fitScore: fitProxy,
    confidence,
    missingEvidenceCount: 0,
    result: {
      companySummary: "Research run completed with website maturity evidence.",
      websiteSummary: fitProxy >= GROWTH_EARLY_OUTREACH_MIN_FIT_SCORE ? "Website evidence captured." : null,
      sourceUrls: fitProxy >= GROWTH_EARLY_OUTREACH_MIN_FIT_SCORE ? ["https://example.com"] : [],
      decisionMakerCandidates: [],
      outreachAngles: fitProxy >= GROWTH_EARLY_OUTREACH_MIN_FIT_SCORE ? ["Field service operations"] : [],
      equipmentServiceIndicators: [],
      equipifyPainPoints: [],
    },
  })
}

const RESEARCH_COMPLETE_WORKFLOW_STATUSES = new Set([
  "research_complete",
  "qualified",
  "assessed",
  "completed",
])

/** Canonical GE-AIOS-21A prospect research completion — not the legacy execution pilot. */
export function hasCompletedCanonicalProspectResearch(input: {
  snapshot?: Pick<GrowthLeadResearchWorkflowSnapshot, "researchRunId" | "workflowStatus" | "leadId"> | null
  leadId?: string | null
}): boolean {
  const snapshot = input.snapshot
  if (!snapshot?.researchRunId?.trim()) return false
  if (input.leadId && snapshot.leadId && snapshot.leadId !== input.leadId) return false
  return RESEARCH_COMPLETE_WORKFLOW_STATUSES.has(snapshot.workflowStatus)
}

export function shouldPreferOutreachOverCommitteeResearch(input: {
  qualification: GrowthLeadResearchQualificationOutput
  hasLikelyContact: boolean
}): boolean {
  if (!input.hasLikelyContact) {
    return (
      input.qualification.confidence >= GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE &&
      input.qualification.fitScore >= GROWTH_EARLY_OUTREACH_MIN_FIT_SCORE
    )
  }
  const action = input.qualification.recommendedNextAction.toLowerCase()
  if (action.includes("committee") || action.includes("decision maker")) return true
  return (
    input.qualification.confidence >= GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE &&
    input.qualification.fitScore >= GROWTH_EARLY_OUTREACH_MIN_FIT_SCORE
  )
}
