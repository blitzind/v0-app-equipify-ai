/** GE-AIOS-22 — Intelligent crawl budget for prospect company evidence (client-safe). */

import type {
  GrowthCompanyEvidenceCrawlState,
  GrowthCompanyEvidenceProfile,
  GrowthCompanyEvidenceQualityScores,
} from "@/lib/growth/research/company-evidence/company-evidence-types"

export const COMPANY_EVIDENCE_MAX_PAGES = 12 as const
export const COMPANY_EVIDENCE_CONFIDENCE_THRESHOLD = 0.75 as const
export const COMPANY_EVIDENCE_MIN_INDUSTRY_ITEMS = 1 as const
export const COMPANY_EVIDENCE_MIN_OFFERING_ITEMS = 2 as const

export type CompanyEvidenceCrawlStopInput = {
  profile: GrowthCompanyEvidenceProfile
  qualityScores: GrowthCompanyEvidenceQualityScores
  pagesCrawled: number
  maxPages?: number
}

export type CompanyEvidenceCrawlStopResult = {
  shouldStop: boolean
  reason: string | null
}

function countOfferingItems(profile: GrowthCompanyEvidenceProfile): number {
  const products = profile.primaryProducts?.values.length ?? 0
  const services = profile.primaryServices?.values.length ?? 0
  return products + services
}

export function evaluateCompanyEvidenceCrawlStop(
  input: CompanyEvidenceCrawlStopInput,
): CompanyEvidenceCrawlStopResult {
  const maxPages = input.maxPages ?? COMPANY_EVIDENCE_MAX_PAGES

  if (input.pagesCrawled >= maxPages) {
    return { shouldStop: true, reason: "max_pages_reached" }
  }

  const scores = input.qualityScores
  const profile = input.profile

  if (scores.overallEvidenceConfidence >= COMPANY_EVIDENCE_CONFIDENCE_THRESHOLD) {
    const hasIndustries = (profile.industriesServed?.values.length ?? 0) >= COMPANY_EVIDENCE_MIN_INDUSTRY_ITEMS
    const hasOfferings = countOfferingItems(profile) >= COMPANY_EVIDENCE_MIN_OFFERING_ITEMS
    if (hasIndustries && hasOfferings) {
      return { shouldStop: true, reason: "confidence_threshold_reached" }
    }
  }

  if (
    (profile.industriesServed?.values.length ?? 0) >= COMPANY_EVIDENCE_MIN_INDUSTRY_ITEMS &&
    countOfferingItems(profile) >= COMPANY_EVIDENCE_MIN_OFFERING_ITEMS &&
    profile.companyDescription &&
    profile.companyDescription.confidence >= 0.7
  ) {
    return { shouldStop: true, reason: "sufficient_evidence_gathered" }
  }

  return { shouldStop: false, reason: null }
}

export function buildCompanyEvidenceMissingInformation(
  profile: GrowthCompanyEvidenceProfile,
): string[] {
  const missing: string[] = []
  if (!profile.companyDescription) missing.push("Company description not found on website.")
  if (!profile.industriesServed?.values.length) missing.push("Industries served not confirmed.")
  if (!profile.primaryProducts?.values.length && !profile.primaryServices?.values.length) {
    missing.push("Products or services not confirmed.")
  }
  if (!profile.targetCustomers?.values.length) missing.push("Target customers not identified.")
  if (!profile.geographicMarkets?.values.length) missing.push("Geographic markets not identified.")
  if (!profile.businessModel) missing.push("Business model not inferred from evidence.")
  return missing
}

export function finalizeCompanyEvidenceCrawlState(input: {
  pagesPlanned: number
  pagesCrawled: number
  websiteCoverage: string[]
  profile: GrowthCompanyEvidenceProfile
  stopResult: CompanyEvidenceCrawlStopResult
}): GrowthCompanyEvidenceCrawlState {
  return {
    pagesPlanned: input.pagesPlanned,
    pagesCrawled: input.pagesCrawled,
    pagesSkipped: Math.max(0, input.pagesPlanned - input.pagesCrawled),
    stoppedEarly: input.stopResult.shouldStop && input.pagesCrawled < input.pagesPlanned,
    stopReason: input.stopResult.reason,
    websiteCoverage: input.websiteCoverage,
    missingInformation: buildCompanyEvidenceMissingInformation(input.profile),
  }
}
