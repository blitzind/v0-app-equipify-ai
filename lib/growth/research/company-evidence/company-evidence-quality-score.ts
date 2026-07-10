/** GE-AIOS-22 — Evidence quality scoring (client-safe). */

import type {
  GrowthCompanyEvidenceProfile,
  GrowthCompanyEvidenceQualityScores,
} from "@/lib/growth/research/company-evidence/company-evidence-types"

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function averageConfidence(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function computeCompanyEvidenceQualityScores(input: {
  profile: GrowthCompanyEvidenceProfile
  websiteFetchOk: boolean
  pagesCrawled: number
  hasVerifiedDomain?: boolean
}): GrowthCompanyEvidenceQualityScores {
  const profile = input.profile

  const identityConfidence = clampScore(input.hasVerifiedDomain !== false ? 0.92 : 0.55)

  const websiteConfidence = clampScore(
    input.websiteFetchOk
      ? 0.55 + Math.min(0.4, input.pagesCrawled * 0.05)
      : 0.15,
  )

  const industryConfidence = clampScore(
    profile.industriesServed?.values.length
      ? averageConfidence([profile.industriesServed.confidence])
      : 0.2,
  )

  const offeringValues = [
    profile.primaryProducts?.confidence ?? 0,
    profile.primaryServices?.confidence ?? 0,
  ].filter((value) => value > 0)
  const offeringConfidence = clampScore(
    offeringValues.length > 0 ? averageConfidence(offeringValues) : 0.18,
  )

  const marketConfidence = clampScore(
    profile.geographicMarkets?.values.length
      ? profile.geographicMarkets.confidence
      : profile.targetCustomers?.values.length
        ? profile.targetCustomers.confidence * 0.85
        : 0.22,
  )

  const descriptionBoost = profile.companyDescription ? profile.companyDescription.confidence * 0.12 : 0
  const overallEvidenceConfidence = clampScore(
    identityConfidence * 0.12 +
      websiteConfidence * 0.22 +
      industryConfidence * 0.22 +
      offeringConfidence * 0.28 +
      marketConfidence * 0.16 +
      descriptionBoost,
  )

  return {
    identityConfidence,
    websiteConfidence,
    industryConfidence,
    offeringConfidence,
    marketConfidence,
    overallEvidenceConfidence,
  }
}
