/** GE-AIOS-EXTERNAL-DISCOVERY-POST-RESEARCH-KEYWORD-VALIDATION-1A — Post-research operational keyword validator (client-safe). */

import { buildProspectSearchFiltersFromBusinessProfile } from "@/lib/growth/business-profile/business-profile-prospect-search-projection-1b"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import {
  evaluateExternalDiscoveryOperationalKeywordMatch,
  evaluateProspectSearchIndustryGatePass,
} from "@/lib/growth/prospect-search/prospect-search-filters"
import type { GrowthCompanyEvidenceBundle } from "@/lib/growth/research/company-evidence/company-evidence-types"
import type { GrowthResearchRunPublicView } from "@/lib/growth/research/research-types"
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
  /** Completed research outputs — included in post-research admission reconciliation only. */
  researchSupplement?: GrowthOperationalKeywordResearchSupplement
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

function includesFold(hay: string | null | undefined, needle: string): boolean {
  if (!hay || !needle) return false
  return hay.toLowerCase().includes(needle.toLowerCase())
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

export type GrowthOperationalKeywordResearchSupplement = {
  researchSummary?: string | null
  suggestedPitchAngle?: string | null
  recommendedNextAction?: string | null
  industryGuess?: string | null
  painSignals?: string[]
  detectedTechnologies?: string[]
  websiteMaturityScore?: number | null
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
    input.researchSupplement?.researchSummary,
    input.researchSupplement?.suggestedPitchAngle,
    input.researchSupplement?.recommendedNextAction,
    input.researchSupplement?.industryGuess,
    ...(input.researchSupplement?.painSignals ?? []),
    ...(input.researchSupplement?.detectedTechnologies ?? []),
  ]).join(" ")
}

export function buildOperationalKeywordResearchSupplementFromRun(
  run: Pick<
    GrowthResearchRunPublicView,
    | "researchSummary"
    | "suggestedPitchAngle"
    | "recommendedNextAction"
    | "industryGuess"
    | "websiteMaturityScore"
    | "detectedTechnologies"
    | "signals"
  > | null | undefined,
): GrowthOperationalKeywordResearchSupplement | undefined {
  if (!run) return undefined
  const painSignals = (run.signals?.painSignals ?? []).map((signal) => signal.replace(/_/g, " "))
  const knowledgePack = run.signals?.prospectKnowledgePack_v25c
  return {
    researchSummary: run.researchSummary,
    suggestedPitchAngle: run.suggestedPitchAngle,
    recommendedNextAction: run.recommendedNextAction ? String(run.recommendedNextAction) : null,
    industryGuess: run.industryGuess ? String(run.industryGuess) : null,
    painSignals,
    detectedTechnologies: run.detectedTechnologies ?? [],
    websiteMaturityScore: run.websiteMaturityScore,
    ...(knowledgePack
      ? {
          researchSummary: [
            run.researchSummary,
            ...(knowledgePack.observed_facts ?? []).map(
              (entry) => entry.evidenceExcerpt ?? entry.field ?? "",
            ),
            ...(knowledgePack.derived_inferences ?? []).map(
              (entry) => entry.evidenceExcerpt ?? entry.field ?? "",
            ),
          ]
            .filter(Boolean)
            .join(" "),
        }
      : {}),
  }
}

function resolveProviderKeywordOperationalProof(
  input: GrowthOperationalKeywordValidationInput,
): { pass: boolean; matchedKeywords: string[] } {
  const providerKeywords = (input.providerKeywords ?? []).map((keyword) => keyword.trim()).filter(Boolean)
  if (providerKeywords.length === 0) {
    return { pass: false, matchedKeywords: [] }
  }

  const matchedFromRequired = input.requiredKeywords.filter((required) =>
    providerKeywords.some(
      (provider) => includesFold(provider, required) || includesFold(required, provider),
    ),
  )
  if (matchedFromRequired.length > 0) {
    return { pass: true, matchedKeywords: matchedFromRequired }
  }

  const blob = buildOperationalKeywordValidationEvidenceBlob(input)
  const matchedFromBlob = providerKeywords.filter((provider) => includesFold(blob, provider))
  if (matchedFromBlob.length > 0) {
    return { pass: true, matchedKeywords: matchedFromBlob }
  }

  return { pass: false, matchedKeywords: [] }
}

function tokenizeOperationalKeywords(keywords: readonly string[]): string[] {
  const tokens = new Set<string>()
  for (const keyword of keywords) {
    for (const part of keyword.split(/[,/|]+/)) {
      for (const token of part.split(/\s+/)) {
        const trimmed = token.trim().toLowerCase()
        if (trimmed.length >= 4) tokens.add(trimmed)
      }
    }
  }
  return [...tokens]
}

function resolvePostResearchOperationalKeywordPass(input: {
  validationInput: GrowthOperationalKeywordValidationInput
  blob: string
  baseMatch: ReturnType<typeof evaluateExternalDiscoveryOperationalKeywordMatch>
  providerProof: { pass: boolean; matchedKeywords: string[] } | null
  researchRun?: Pick<
    GrowthResearchRunPublicView,
    "researchSummary" | "signals" | "recommendedNextAction" | "researchConfidence"
  > | null
}): boolean {
  if (input.baseMatch.pass || input.providerProof?.pass) return true

  const tokenMatch = evaluateExternalDiscoveryOperationalKeywordMatch(
    input.blob,
    tokenizeOperationalKeywords(input.validationInput.requiredKeywords),
  )
  if (tokenMatch.pass) return true

  const researchRun = input.researchRun
  if (!researchRun?.researchSummary?.trim()) return false

  const hasOperationalResearchSignal =
    (researchRun.signals?.painSignals.length ?? 0) > 0 ||
    Boolean(researchRun.signals?.companyEvidence_v22) ||
    Boolean(researchRun.signals?.prospectKnowledgePack_v25c) ||
    (input.validationInput.providerKeywords?.length ?? 0) > 0

  const confidenceRaw = researchRun.researchConfidence ?? 0
  const confidence = confidenceRaw <= 1 ? confidenceRaw : confidenceRaw / 100

  return hasOperationalResearchSignal && confidence >= 0.35 && input.blob.trim().length >= 80
}

export function evaluateGrowthOperationalKeywordValidation(
  input: GrowthOperationalKeywordValidationInput & {
    researchRun?: Pick<
      GrowthResearchRunPublicView,
      "researchSummary" | "signals" | "recommendedNextAction" | "researchConfidence"
    > | null
  },
): GrowthOperationalKeywordValidationResult {
  const blob = buildOperationalKeywordValidationEvidenceBlob(input)
  const match = evaluateExternalDiscoveryOperationalKeywordMatch(blob, input.requiredKeywords)
  const providerProof = match.pass ? null : resolveProviderKeywordOperationalProof(input)
  const pass = resolvePostResearchOperationalKeywordPass({
    validationInput: input,
    blob,
    baseMatch: match,
    providerProof,
    researchRun: input.researchRun ?? null,
  })
  const matchedKeywords = pass
    ? match.pass
      ? match.matchedKeywords
      : providerProof?.pass && !match.pass
        ? (providerProof.matchedKeywords ?? [])
        : tokenizeOperationalKeywords(input.requiredKeywords).filter((token) => includesFold(blob, token)).slice(0, 4)
    : match.matchedKeywords
  const missingKeywords = pass ? [] : match.missingKeywords
  const confidence =
    input.requiredKeywords.length === 0
      ? 1
      : matchedKeywords.length / input.requiredKeywords.length

  return {
    qaMarker: GROWTH_OPERATIONAL_KEYWORD_VALIDATION_1A_QA_MARKER,
    version: GROWTH_OPERATIONAL_KEYWORD_VALIDATION_VERSION,
    matchedKeywords,
    missingKeywords,
    confidence,
    pass,
    reason: pass
      ? providerProof?.pass && !match.pass
        ? `Matched provider operational keywords: ${matchedKeywords.join(", ")}`
        : match.pass
          ? `Matched operational keywords: ${matchedKeywords.join(", ")}`
          : input.researchRun?.researchSummary?.trim()
            ? "Post-research operational evidence satisfied deferred external-discovery keyword gate."
            : `Matched operational keywords: ${matchedKeywords.join(", ")}`
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

function resolveResearchOperationalEvidence(
  researchRun?: Pick<
    GrowthResearchRunPublicView,
    | "researchSummary"
    | "suggestedPitchAngle"
    | "suggestedSequence"
    | "suggestedCallOpening"
    | "recommendedNextAction"
    | "industryGuess"
    | "detectedTechnologies"
    | "signals"
  > | null,
): string[] {
  if (!researchRun) return []
  const knowledgePack = researchRun.signals?.prospectKnowledgePack_v25c
  const knowledgeStatements = [
    ...(knowledgePack?.observed_facts ?? []),
    ...(knowledgePack?.derived_inferences ?? []),
  ]
    .map((entry) => {
      if (typeof entry.value === "string") return entry.value
      if (Array.isArray(entry.value)) return entry.value.join(" ")
      if (typeof entry.value === "boolean") return entry.field
      return entry.evidenceExcerpt
    })
    .filter((value): value is string => Boolean(value?.trim()))

  return uniqueStrings([
    researchRun.researchSummary,
    researchRun.suggestedPitchAngle,
    researchRun.suggestedSequence,
    researchRun.suggestedCallOpening,
    researchRun.recommendedNextAction != null ? String(researchRun.recommendedNextAction) : null,
    researchRun.industryGuess != null ? String(researchRun.industryGuess) : null,
    ...(researchRun.detectedTechnologies ?? []),
    ...(researchRun.signals?.painSignals ?? []),
    ...knowledgeStatements,
  ])
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
  researchRun?: Pick<
    GrowthResearchRunPublicView,
    | "researchSummary"
    | "suggestedPitchAngle"
    | "suggestedSequence"
    | "suggestedCallOpening"
    | "recommendedNextAction"
    | "industryGuess"
    | "detectedTechnologies"
    | "signals"
  > | null
  approvedProfile: BusinessProfileDraftContent
}): GrowthOperationalKeywordValidationInput {
  const profile = input.evidenceBundle?.profile
  const researchEvidence = resolveResearchOperationalEvidence(input.researchRun)
  return {
    companyName: input.companyName,
    website: input.website,
    industry: input.industry ?? (input.researchRun?.industryGuess != null
      ? String(input.researchRun.industryGuess)
      : null),
    subindustry: input.subindustry,
    notes: input.notes,
    providerKeywords: input.providerKeywords,
    providerSignals: input.providerSignals,
    matchReasoning: input.matchReasoning,
    websiteCrawlText: input.websiteCrawlText ?? input.researchRun?.researchSummary ?? null,
    companyDescription: profile?.companyDescription?.value ?? null,
    primaryServices: profile?.primaryServices?.values ?? [],
    primaryProducts: profile?.primaryProducts?.values ?? [],
    industriesServed: profile?.industriesServed?.values ?? [],
    operationalEvidence: uniqueStrings([
      ...(input.evidenceBundle?.evidenceSources ?? []),
      ...researchEvidence,
    ]),
    researchSupplement: buildOperationalKeywordResearchSupplementFromRun(input.researchRun),
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
