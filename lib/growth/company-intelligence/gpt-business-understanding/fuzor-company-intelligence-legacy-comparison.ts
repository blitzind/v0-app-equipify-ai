/**
 * FUZOR-COMPANY-INTELLIGENCE-1A — Validation-only snapshot of legacy deterministic
 * research interpretation. Not part of the GPT understanding path.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchLatestCompletedProspectResearchRun } from "@/lib/growth/research/research-repository"

export type LegacyDeterministicCompanyInterpretation = {
  researchSummary: string | null
  industryGuess: string | null
  websiteMaturityScore: number | null
  researchConfidence: number | null
  painSignals: string[]
  detectedTechnologies: string[]
  suggestedPitchAngle: string | null
  recommendedNextAction: string | null
  qualityScores: Record<string, number> | null
  missionComparisonLabels: string[] | null
  qualificationHeadline: string | null
  qualificationDecision: string | null
}

export async function loadLegacyDeterministicCompanyInterpretation(input: {
  admin: SupabaseClient
  leadId: string
}): Promise<LegacyDeterministicCompanyInterpretation | null> {
  const research = await fetchLatestCompletedProspectResearchRun(input.admin, input.leadId).catch(
    () => null,
  )
  if (!research) return null

  const bundle = research.signals.companyEvidence_v22
  return {
    researchSummary: research.researchSummary,
    industryGuess: research.industryGuess,
    websiteMaturityScore: research.websiteMaturityScore,
    researchConfidence: research.researchConfidence,
    painSignals: [...(research.signals.painSignals ?? [])],
    detectedTechnologies: [...(research.detectedTechnologies ?? [])],
    suggestedPitchAngle: research.suggestedPitchAngle,
    recommendedNextAction: research.recommendedNextAction,
    qualityScores: bundle?.qualityScores
      ? {
          identityConfidence: bundle.qualityScores.identityConfidence,
          websiteConfidence: bundle.qualityScores.websiteConfidence,
          industryConfidence: bundle.qualityScores.industryConfidence,
          offeringConfidence: bundle.qualityScores.offeringConfidence,
          marketConfidence: bundle.qualityScores.marketConfidence,
          overallEvidenceConfidence: bundle.qualityScores.overallEvidenceConfidence,
        }
      : null,
    missionComparisonLabels: bundle?.missionComparison?.labels ?? null,
    qualificationHeadline: bundle?.qualificationExplanation?.headline ?? null,
    qualificationDecision: bundle?.qualificationExplanation?.decision ?? null,
  }
}
