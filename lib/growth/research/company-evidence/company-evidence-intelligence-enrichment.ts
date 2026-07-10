/** GE-AIOS-22 — Enrich company intelligence fields from prospect evidence (client-safe). */

import type {
  GrowthCompanyEvidenceBundle,
  GrowthCompanyEvidenceProfile,
} from "@/lib/growth/research/company-evidence/company-evidence-types"

export type GrowthCompanyIntelligenceEvidenceEnrichment = {
  verifiedIndustries: string[]
  verifiedServices: string[]
  verifiedProducts: string[]
  verifiedMarkets: string[]
  verifiedBusinessDescription: string | null
  verifiedDifferentiators: string[]
  verifiedCustomerTypes: string[]
  verifiedTechnologySignals: string[]
  verifiedHiringSignals: string[]
  evidenceSources: string[]
  evidenceConfidence: number
  missingEvidence: string[]
}

export function enrichCompanyIntelligenceFromEvidence(
  bundle: GrowthCompanyEvidenceBundle | null | undefined,
): GrowthCompanyIntelligenceEvidenceEnrichment | null {
  if (!bundle) return null

  const profile = bundle.profile

  return {
    verifiedIndustries: profile.industriesServed?.values ?? [],
    verifiedServices: profile.primaryServices?.values ?? [],
    verifiedProducts: profile.primaryProducts?.values ?? [],
    verifiedMarkets: profile.geographicMarkets?.values ?? [],
    verifiedBusinessDescription: profile.companyDescription?.value ?? null,
    verifiedDifferentiators: profile.differentiators?.values ?? [],
    verifiedCustomerTypes: profile.targetCustomers?.values ?? [],
    verifiedTechnologySignals: profile.technologySignals?.values ?? [],
    verifiedHiringSignals: profile.hiringSignals?.values ?? [],
    evidenceSources: bundle.evidenceSources,
    evidenceConfidence: bundle.qualityScores.overallEvidenceConfidence,
    missingEvidence: bundle.crawlState.missingInformation,
  }
}

export function mergeEvidenceIntoResearchSummary(input: {
  baseSummary: string
  enrichment: GrowthCompanyIntelligenceEvidenceEnrichment | null
}): string {
  if (!input.enrichment) return input.baseSummary

  const evidenceLines: string[] = []
  if (input.enrichment.verifiedBusinessDescription) {
    evidenceLines.push(`Verified description: ${input.enrichment.verifiedBusinessDescription.slice(0, 220)}`)
  }
  if (input.enrichment.verifiedIndustries.length) {
    evidenceLines.push(`Verified industries: ${input.enrichment.verifiedIndustries.slice(0, 4).join(", ")}`)
  }
  if (input.enrichment.verifiedProducts.length || input.enrichment.verifiedServices.length) {
    const offerings = [
      ...input.enrichment.verifiedProducts.slice(0, 2),
      ...input.enrichment.verifiedServices.slice(0, 2),
    ]
    evidenceLines.push(`Verified offerings: ${offerings.join(", ")}`)
  }

  if (evidenceLines.length === 0) return input.baseSummary
  return `${input.baseSummary}\n\nEvidence profile (${Math.round(input.enrichment.evidenceConfidence * 100)}% confidence):\n${evidenceLines.join("\n")}`
}

export function resolveVerifiedIndustryGuess(
  profile: GrowthCompanyEvidenceProfile,
  fallbackIndustry: string | null,
): string | null {
  const verified = profile.industriesServed?.values[0]?.trim()
  if (verified) return verified
  return fallbackIndustry
}
