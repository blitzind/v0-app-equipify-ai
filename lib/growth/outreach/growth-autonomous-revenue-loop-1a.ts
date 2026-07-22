/** GE-AIOS-OUTREACH-1A — Autonomous revenue loop: research enables outreach, not the destination. */

import type { GrowthLeadResearchQualificationOutput } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import type { GrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import type { GrowthLeadResearchResult, GrowthResearchRunPublicView } from "@/lib/growth/research/research-types"
import type { GrowthLead } from "@/lib/growth/types"

export const GROWTH_AUTONOMOUS_REVENUE_LOOP_1A_QA_MARKER =
  "ge-aios-outreach-1a-autonomous-revenue-loop-v1" as const

/** Good-enough qualification threshold — exit research and begin outreach prep. */
export const GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE = 0.5 as const

/** Minimum fit to pursue early outreach after research. */
export const GROWTH_EARLY_OUTREACH_MIN_FIT_SCORE = 55 as const

/** Max missing evidence items before research must continue (obvious disqualifier path). */
export const GROWTH_RESEARCH_EXIT_MAX_MISSING_EVIDENCE = 3 as const

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

/** Research should stop — advance toward outreach prep (draft factory / approval queue). */
export function isResearchCompleteForOutreach(input: {
  fitScore: number
  confidence: number
  missingEvidenceCount: number
  result?: Pick<GrowthLeadResearchResult, "companySummary" | "websiteSummary" | "sourceUrls" | "decisionMakerCandidates"> | null
  lead?: Pick<GrowthLead, "decisionMakerStatus" | "primaryDecisionMakerId" | "contactName"> | null
  researchTimeBudgetExhausted?: boolean
}): boolean {
  if (isObviousDisqualifier(input)) return true
  if (input.researchTimeBudgetExhausted === true) return true
  if (hasEnoughWebsiteEvidence(input.result ?? { companySummary: "", websiteSummary: null, sourceUrls: [] })) {
    if (input.confidence >= GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE && input.fitScore >= GROWTH_EARLY_OUTREACH_MIN_FIT_SCORE) {
      return true
    }
  }
  if (
    input.confidence >= GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE &&
    input.fitScore >= GROWTH_EARLY_OUTREACH_MIN_FIT_SCORE &&
    hasLikelyDecisionMaker({ lead: input.lead, result: input.result ?? null })
  ) {
    return true
  }
  return false
}

export function isGoodEnoughForEarlyOutreach(input: {
  fitScore: number
  confidence: number
  missingEvidenceCount: number
  result?: Pick<GrowthLeadResearchResult, "decisionMakerCandidates"> | null
  lead?: Pick<GrowthLead, "decisionMakerStatus" | "primaryDecisionMakerId" | "contactName"> | null
}): boolean {
  if (isObviousDisqualifier(input)) return false
  if (input.fitScore < GROWTH_EARLY_OUTREACH_MIN_FIT_SCORE) return false
  if (input.confidence < GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE) return false
  if (input.missingEvidenceCount > GROWTH_RESEARCH_EXIT_MAX_MISSING_EVIDENCE) return false
  return hasLikelyDecisionMaker({ lead: input.lead, result: input.result ?? null })
}

export function isGoodEnoughForEarlyOutreachFromRun(
  run: Pick<GrowthResearchRunPublicView, "researchConfidence" | "websiteMaturityScore">,
): boolean {
  const raw = run.researchConfidence ?? 0
  const confidence = raw <= 1 ? raw : raw / 100
  if (confidence < GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE) return false
  const maturity = run.websiteMaturityScore ?? raw
  const fitProxy = maturity <= 1 ? maturity * 100 : maturity
  return fitProxy >= GROWTH_EARLY_OUTREACH_MIN_FIT_SCORE || confidence >= GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE
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
  if (!input.hasLikelyContact) return false
  const action = input.qualification.recommendedNextAction.toLowerCase()
  if (action.includes("committee") || action.includes("decision maker")) return true
  return (
    input.qualification.confidence >= GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE &&
    input.qualification.fitScore >= GROWTH_EARLY_OUTREACH_MIN_FIT_SCORE
  )
}
