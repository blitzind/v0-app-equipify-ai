/** GE-AIOS-22 — Evidence-backed qualification explainability (client-safe). */

import type { GrowthLeadAdmissionState } from "@/lib/growth/revenue-workflow/growth-lead-admission-types"
import type {
  GrowthCompanyEvidenceMissionComparison,
  GrowthCompanyEvidenceProfile,
  GrowthCompanyEvidenceQualificationDecision,
  GrowthCompanyEvidenceQualificationExplanation,
  GrowthCompanyEvidenceQualityScores,
} from "@/lib/growth/research/company-evidence/company-evidence-types"

function mapAdmissionToDecision(
  admissionState: GrowthLeadAdmissionState | null | undefined,
): GrowthCompanyEvidenceQualificationDecision {
  switch (admissionState) {
    case "accepted":
      return "accepted"
    case "review":
      return "review"
    case "rejected":
    case "invalid":
      return "rejected"
    default:
      return "unknown"
  }
}

function headlineForDecision(decision: GrowthCompanyEvidenceQualificationDecision): string {
  switch (decision) {
    case "accepted":
      return "Accepted because verified website evidence supports ICP fit."
    case "review":
      return "In review because evidence is partial or identity needs confirmation."
    case "rejected":
      return "Rejected because verified evidence conflicts with ICP or identity."
    default:
      return "Qualification pending verified company evidence."
  }
}

export function buildCompanyEvidenceQualificationExplanation(input: {
  profile: GrowthCompanyEvidenceProfile
  qualityScores: GrowthCompanyEvidenceQualityScores
  missionComparison: GrowthCompanyEvidenceMissionComparison | null
  admissionState?: GrowthLeadAdmissionState | null
  evidenceSources: string[]
  missingEvidence: string[]
}): GrowthCompanyEvidenceQualificationExplanation {
  const decision = mapAdmissionToDecision(input.admissionState)
  const reasons: string[] = []

  if (input.profile.companyDescription?.value) {
    reasons.push(`Website identifies the company as ${input.profile.companyDescription.value.slice(0, 160)}.`)
  }

  if (input.profile.industriesServed?.values.length) {
    reasons.push(`Serves ${input.profile.industriesServed.values.slice(0, 4).join(", ")}.`)
  }

  if (input.profile.primaryProducts?.values.length || input.profile.primaryServices?.values.length) {
    const offerings = [
      ...(input.profile.primaryProducts?.values ?? []).slice(0, 2),
      ...(input.profile.primaryServices?.values ?? []).slice(0, 2),
    ]
    reasons.push(`Offerings include ${offerings.join(", ")}.`)
  }

  if (input.profile.geographicMarkets?.values.length) {
    reasons.push(`Geographic markets: ${input.profile.geographicMarkets.values.slice(0, 3).join(", ")}.`)
  }

  for (const explanation of input.missionComparison?.explanations ?? []) {
    if (!reasons.includes(explanation)) reasons.push(explanation)
  }

  if (reasons.length === 0) {
    reasons.push("Insufficient verified website evidence to explain qualification.")
  }

  return {
    decision,
    headline: headlineForDecision(decision),
    reasons: reasons.slice(0, 8),
    confidencePercent: Math.round(input.qualityScores.overallEvidenceConfidence * 100),
    evidenceSources: input.evidenceSources.slice(0, 12),
    missingEvidence: input.missingEvidence.slice(0, 8),
  }
}
