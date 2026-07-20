/**
 * GE-AIOS-FIRST-CUSTOMER-SUPERVISED-SALES-1B — Production lead scoring (client-safe).
 */

import type { SupervisedSalesProductionLeadCandidate } from "@/lib/growth/training/supervised-sales-workflow-1b-types"

export type SupervisedSalesLeadSelectionInput = {
  leadId: string
  companyName: string | null
  admissionState: string
  outreachEligible: boolean
  hasResearch: boolean
  researchRunId?: string | null
  lastResearchedAt?: string | null
  contactName?: string | null
  contactTitle?: string | null
  industry?: string | null
  website?: string | null
  evidenceCount?: number
  researchConfidence?: number | null
  hasDecisionMaker?: boolean
  hasExistingPackage?: boolean
  sellerKnowledgeReady?: boolean
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function scoreSupervisedSalesLeadCandidate(
  input: SupervisedSalesLeadSelectionInput,
): { qualityScore: number; scoreBreakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {}

  breakdown.admission =
    input.admissionState === "accepted" ? 1 : input.admissionState === "review" ? 0.65 : 0
  breakdown.outreachEligible = input.outreachEligible ? 1 : 0
  breakdown.research = input.hasResearch ? 1 : 0
  breakdown.evidence = clamp01((input.evidenceCount ?? 0) / 5)
  breakdown.researchConfidence = clamp01(input.researchConfidence ?? (input.hasResearch ? 0.6 : 0))
  breakdown.decisionMaker = input.hasDecisionMaker ? 1 : 0.3
  breakdown.existingPackage = input.hasExistingPackage ? 0.15 : 0
  breakdown.sellerKnowledge = input.sellerKnowledgeReady !== false ? 1 : 0

  const weights = {
    admission: 0.22,
    outreachEligible: 0.18,
    research: 0.2,
    evidence: 0.15,
    researchConfidence: 0.1,
    decisionMaker: 0.1,
    existingPackage: 0.03,
    sellerKnowledge: 0.02,
  }

  let qualityScore = 0
  for (const [key, weight] of Object.entries(weights)) {
    qualityScore += (breakdown[key] ?? 0) * weight
  }

  return { qualityScore: clamp01(qualityScore), scoreBreakdown: breakdown }
}

export function rankSupervisedSalesLeadCandidates(
  candidates: SupervisedSalesLeadSelectionInput[],
  limit = 5,
): SupervisedSalesProductionLeadCandidate[] {
  const ranked = candidates
    .map((candidate) => {
      const scored = scoreSupervisedSalesLeadCandidate(candidate)
      return {
        leadId: candidate.leadId,
        companyName: candidate.companyName,
        admissionState: candidate.admissionState,
        outreachEligible: candidate.outreachEligible,
        hasResearch: candidate.hasResearch,
        researchRunId: candidate.researchRunId ?? null,
        lastResearchedAt: candidate.lastResearchedAt ?? null,
        contactName: candidate.contactName ?? null,
        contactTitle: candidate.contactTitle ?? null,
        industry: candidate.industry ?? null,
        website: candidate.website ?? null,
        qualityScore: scored.qualityScore,
        scoreBreakdown: scored.scoreBreakdown,
        existingPackageId: null as string | null,
      }
    })
    .filter(
      (row) =>
        row.outreachEligible &&
        row.hasResearch &&
        (row.admissionState === "accepted" || row.admissionState === "review"),
    )
    .sort((a, b) => b.qualityScore - a.qualityScore)

  return ranked.slice(0, limit)
}
