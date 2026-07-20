/** GE-AIOS-MARKET-INTELLIGENCE-LOOP-1A — Market Intelligence snapshot aggregator (client-safe). */

import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import type { OrganizationalKnowledgeItem } from "@/lib/growth/memory/knowledge/organization-knowledge-types"
import { filterValidatedInstitutionalLearnings } from "@/lib/growth/memory/institutional-learning/growth-institutional-learning-truthfulness-1a"
import {
  GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER,
  type BuildMarketIntelligenceSnapshotInput,
  type MarketIntelligenceEvidenceRef,
  type MarketIntelligenceSnapshot,
  type MarketIntelligenceSnapshotDimension,
} from "@/lib/growth/market-intelligence/growth-market-intelligence-loop-1a-types"

function dimensionFromProfile(
  values: string[],
  source: MarketIntelligenceEvidenceRef["source"],
): MarketIntelligenceSnapshotDimension {
  return {
    values: values.filter(Boolean),
    source,
    confidence: values.length > 0 ? 90 : null,
  }
}

function dimensionFromLearnings(
  items: OrganizationalKnowledgeItem[],
  categories: OrganizationalKnowledgeItem["category"][],
): MarketIntelligenceSnapshotDimension {
  const matched = items.filter((row) => categories.includes(row.category))
  return {
    values: matched.map((row) => row.finding),
    source: "institutional_learning",
    confidence:
      matched.length > 0
        ? Math.round(matched.reduce((sum, row) => sum + row.confidence, 0) / matched.length)
        : null,
  }
}

export function buildMarketIntelligenceSnapshot(
  input: BuildMarketIntelligenceSnapshotInput,
): MarketIntelligenceSnapshot {
  const profile = input.approvedProfile
  const validatedLearnings = filterValidatedInstitutionalLearnings(input.validatedLearnings)

  const evidenceRefs: MarketIntelligenceEvidenceRef[] = [...input.evidenceRefs]
  for (const learning of validatedLearnings) {
    evidenceRefs.push({
      source: "institutional_learning",
      label: learning.finding,
      referenceId: learning.knowledge_id,
      observedAt: learning.last_confirmed_at,
    })
  }

  return {
    qaMarker: GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER,
    organizationId: input.organizationId,
    capturedAt: input.generatedAt,
    industries: profile
      ? dimensionFromProfile(profile.idealCustomers.targetIndustries, "business_profile")
      : dimensionFromProfile(input.biIndustries ?? [], "business_intelligence"),
    personas: profile
      ? dimensionFromProfile(profile.idealCustomers.buyerPersonas, "business_profile")
      : dimensionFromProfile(input.biPersonas ?? [], "business_intelligence"),
    companySizes: profile
      ? dimensionFromProfile(profile.idealCustomers.companySizeRanges, "business_profile")
      : { values: [], source: "business_profile", confidence: null },
    geographies: profile
      ? dimensionFromProfile(profile.idealCustomers.geography, "business_profile")
      : dimensionFromProfile(input.biGeographies ?? [], "business_intelligence"),
    technologies: { values: [], source: "business_profile", confidence: null },
    painPoints: profile
      ? dimensionFromProfile(profile.problemsAndTriggers.painPoints, "business_profile")
      : dimensionFromProfile(input.biPainPoints ?? [], "business_intelligence"),
    messaging: profile
      ? dimensionFromProfile(profile.salesAndMarketing.messagingAngles, "business_profile")
      : dimensionFromProfile(input.biMessaging ?? [], "business_intelligence"),
    pricing: dimensionFromProfile(input.biPricing ?? [], "business_intelligence"),
    objections: dimensionFromProfile(input.biObjections ?? [], "business_intelligence"),
    competitors: profile
      ? dimensionFromProfile(profile.problemsAndTriggers.competitorsAlternatives, "business_profile")
      : dimensionFromProfile(input.biCompetitors ?? [], "business_intelligence"),
    retention: dimensionFromLearnings(validatedLearnings, ["market", "sales_process"]),
    expansion: dimensionFromLearnings(validatedLearnings, ["market"]),
    segmentPerformance: input.segmentMetrics,
    validatedLearnings,
    supportingEvidence: evidenceRefs,
  }
}

export function summarizeCurrentStrategyFromProfile(
  profile: BusinessProfileDraftContent | null,
): string {
  if (!profile) return "Complete your Company Profile so Ava can manage market strategy."
  const industries = profile.idealCustomers.targetIndustries.slice(0, 3).join(", ")
  const personas = profile.idealCustomers.buyerPersonas.slice(0, 2).join(", ")
  const geo = profile.idealCustomers.geography.slice(0, 2).join(", ")
  const parts: string[] = []
  if (industries) parts.push(`Targeting ${industries}`)
  if (personas) parts.push(`reaching ${personas}`)
  if (geo) parts.push(`in ${geo}`)
  return parts.length > 0 ? parts.join(", ") + "." : "Approved Company Profile is active."
}

export function profileFingerprint(profile: BusinessProfileDraftContent): string {
  return JSON.stringify({
    industries: profile.idealCustomers.targetIndustries,
    personas: profile.idealCustomers.buyerPersonas,
    geography: profile.idealCustomers.geography,
    sizes: profile.idealCustomers.companySizeRanges,
    keywords: profile.problemsAndTriggers.keywords,
    disqualifiers: profile.idealCustomers.disqualifiers,
  })
}
