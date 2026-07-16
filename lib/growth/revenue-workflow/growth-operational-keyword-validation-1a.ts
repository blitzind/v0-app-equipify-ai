/** GE-AIOS-EXTERNAL-DISCOVERY-POST-RESEARCH-KEYWORD-VALIDATION-1A — Post-research operational keyword validator (client-safe). */

import { buildProspectSearchFiltersFromBusinessProfile } from "@/lib/growth/business-profile/business-profile-prospect-search-projection-1b"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import {
  evaluateExternalDiscoveryOperationalKeywordMatch,
  evaluateProspectSearchIndustryGatePass,
} from "@/lib/growth/prospect-search/prospect-search-filters"
import type { GrowthCompanyEvidenceBundle } from "@/lib/growth/research/company-evidence/company-evidence-types"
import type { LeadIntakeSource } from "@/lib/growth/revenue-workflow/unified-lead-intake-types"

export const GROWTH_OPERATIONAL_KEYWORD_VALIDATION_1A_QA_MARKER =
  "ge-aios-external-discovery-post-research-keyword-validation-1a-v1" as const

export const GROWTH_OPERATIONAL_KEYWORD_VALIDATION_VERSION =
  "growth-operational-keyword-validation-2026-07-16" as const

const EXTERNAL_DISCOVERY_INTAKE_SOURCES = new Set<LeadIntakeSource>(["datamoon"])

export type GrowthOperationalKeywordValidationInput = {
  companyName: string
  website?: string | null
  industry?: string | null
  subindustry?: string | null
  notes?: string | null
  providerKeywords?: string[]
  providerSignals?: string[]
  matchReasoning?: string[]
  /** Website crawl plain text or HTML-derived text */
  websiteCrawlText?: string | null
  /** Structured company research profile */
  companyDescription?: string | null
  primaryServices?: string[]
  primaryProducts?: string[]
  industriesServed?: string[]
  operationalEvidence?: string[]
  /** Business Profile operational keywords (first 8 when sourced from Prospect Search projection). */
  requiredKeywords: readonly string[]
}

export type GrowthOperationalKeywordValidationResult = {
  qaMarker: typeof GROWTH_OPERATIONAL_KEYWORD_VALIDATION_1A_QA_MARKER
  version: typeof GROWTH_OPERATIONAL_KEYWORD_VALIDATION_VERSION
  matchedKeywords: string[]
  missingKeywords: string[]
  confidence: number
  pass: boolean
  reason: string | null
  evidenceBlobLength: number
}

export function isExternalDiscoveryLeadIntakeSource(
  source: LeadIntakeSource | string | null | undefined,
): boolean {
  return typeof source === "string" && EXTERNAL_DISCOVERY_INTAKE_SOURCES.has(source as LeadIntakeSource)
}

export function resolveOperationalKeywordsFromBusinessProfile(
  profile: BusinessProfileDraftContent,
): string[] {
  return buildProspectSearchFiltersFromBusinessProfile(profile).keywords ?? []
}

function uniqueStrings(values: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const trimmed = value?.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}

export function buildOperationalKeywordValidationEvidenceBlob(
  input: GrowthOperationalKeywordValidationInput,
): string {
  return uniqueStrings([
    input.companyName,
    input.website,
    input.industry,
    input.subindustry,
    input.notes,
    input.companyDescription,
    ...(input.providerKeywords ?? []),
    ...(input.providerSignals ?? []),
    ...(input.matchReasoning ?? []),
    ...(input.primaryServices ?? []),
    ...(input.primaryProducts ?? []),
    ...(input.industriesServed ?? []),
    ...(input.operationalEvidence ?? []),
    input.websiteCrawlText,
  ]).join(" ")
}

export function evaluateGrowthOperationalKeywordValidation(
  input: GrowthOperationalKeywordValidationInput,
): GrowthOperationalKeywordValidationResult {
  const blob = buildOperationalKeywordValidationEvidenceBlob(input)
  const match = evaluateExternalDiscoveryOperationalKeywordMatch(blob, input.requiredKeywords)
  const confidence =
    input.requiredKeywords.length === 0
      ? 1
      : match.matchedKeywords.length / input.requiredKeywords.length

  return {
    qaMarker: GROWTH_OPERATIONAL_KEYWORD_VALIDATION_1A_QA_MARKER,
    version: GROWTH_OPERATIONAL_KEYWORD_VALIDATION_VERSION,
    matchedKeywords: match.matchedKeywords,
    missingKeywords: match.missingKeywords,
    confidence,
    pass: match.pass,
    reason: match.pass
      ? `Matched operational keywords: ${match.matchedKeywords.join(", ")}`
      : match.missingKeywords.length > 0
        ? `Missing operational keyword evidence for: ${match.missingKeywords.join(", ")}`
        : "No operational keywords configured",
    evidenceBlobLength: blob.length,
  }
}

export function buildOperationalKeywordValidationMetadata(
  result: GrowthOperationalKeywordValidationResult,
  evaluatedAt: string = new Date().toISOString(),
): Record<string, unknown> {
  return {
    operational_keyword_validation_pass: result.pass,
    operational_keyword_validation_matched: result.matchedKeywords,
    operational_keyword_validation_missing: result.missingKeywords,
    operational_keyword_validation_confidence: result.confidence,
    operational_keyword_validation_reason: result.reason,
    operational_keyword_validation_version: result.version,
    operational_keyword_validation_evaluated_at: evaluatedAt,
    operational_keyword_validation_qa_marker: result.qaMarker,
  }
}

export function buildGrowthOperationalKeywordValidationInputFromResearch(input: {
  companyName: string
  website?: string | null
  industry?: string | null
  subindustry?: string | null
  notes?: string | null
  providerKeywords?: string[]
  providerSignals?: string[]
  matchReasoning?: string[]
  websiteCrawlText?: string | null
  evidenceBundle?: GrowthCompanyEvidenceBundle | null
  approvedProfile: BusinessProfileDraftContent
}): GrowthOperationalKeywordValidationInput {
  const profile = input.evidenceBundle?.profile
  return {
    companyName: input.companyName,
    website: input.website,
    industry: input.industry,
    subindustry: input.subindustry,
    notes: input.notes,
    providerKeywords: input.providerKeywords,
    providerSignals: input.providerSignals,
    matchReasoning: input.matchReasoning,
    websiteCrawlText: input.websiteCrawlText,
    companyDescription: profile?.companyDescription?.value ?? null,
    primaryServices: profile?.primaryServices?.values ?? [],
    primaryProducts: profile?.primaryProducts?.values ?? [],
    industriesServed: profile?.industriesServed?.values ?? [],
    operationalEvidence: input.evidenceBundle?.evidenceSources ?? [],
    requiredKeywords: resolveOperationalKeywordsFromBusinessProfile(input.approvedProfile),
  }
}

export function evaluateExternalDiscoveryIndustryGateFromEvidence(input: {
  companyName: string
  website?: string | null
  industry?: string | null
  subindustry?: string | null
  notes?: string | null
  keywords?: string[]
  signals?: string[]
  matchReasoning?: string[]
  approvedProfile: BusinessProfileDraftContent
}): boolean {
  const filters = buildProspectSearchFiltersFromBusinessProfile(input.approvedProfile)
  return evaluateProspectSearchIndustryGatePass(
    {
      company_name: input.companyName,
      industry: input.industry ?? null,
      subindustry: input.subindustry ?? null,
      keywords: input.keywords,
      notes: input.notes ?? null,
      signals: input.signals ?? [],
      match_reasoning: input.matchReasoning,
    },
    filters,
  )
}
