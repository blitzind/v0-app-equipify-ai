/** GE-AIOS-MARKET-INTELLIGENCE-LOOP-1A — Business Profile draft proposal (client-safe apply logic). */

import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import { profileFingerprint } from "@/lib/growth/market-intelligence/growth-market-intelligence-aggregator-1a"
import { summarizeMarketIntelligenceProposal } from "@/lib/growth/market-intelligence/growth-market-intelligence-explainability-1a"
import {
  GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER,
  type MarketIntelligenceProposal,
  type MarketIntelligenceRecommendation,
} from "@/lib/growth/market-intelligence/growth-market-intelligence-loop-1a-types"

function asStringArray(value: string | string[]): string[] {
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean)
}

export function applyMarketIntelligenceRecommendationToProfile(
  profile: BusinessProfileDraftContent,
  recommendation: MarketIntelligenceRecommendation,
): BusinessProfileDraftContent {
  const next: BusinessProfileDraftContent = structuredClone(profile)
  const afterValues = asStringArray(recommendation.after)

  switch (recommendation.kind) {
    case "add_industry":
    case "remove_industry":
    case "increase_priority":
    case "decrease_priority":
      next.idealCustomers.targetIndustries = afterValues
      break
    case "add_persona":
    case "remove_persona":
      next.idealCustomers.buyerPersonas = afterValues
      break
    case "expand_geography":
    case "reduce_geography":
      next.idealCustomers.geography = afterValues
      break
    case "adjust_company_size":
      next.idealCustomers.companySizeRanges = afterValues
      break
    case "update_messaging":
      next.salesAndMarketing.messagingAngles = afterValues
      break
    case "update_objections":
      next.problemsAndTriggers.painPoints = afterValues
      break
    case "update_competitors":
      next.problemsAndTriggers.competitorsAlternatives = afterValues
      break
    case "add_technology":
      break
    default:
      break
  }

  next.confidence.assumptions = [
    ...new Set([
      ...next.confidence.assumptions,
      "Proposed from validated market intelligence — requires separate Company Profile approval.",
    ]),
  ]
  next.draftSource = "deterministic"

  return next
}

export function applyMarketIntelligenceRecommendationsToProfile(
  profile: BusinessProfileDraftContent,
  recommendations: MarketIntelligenceRecommendation[],
): BusinessProfileDraftContent {
  return recommendations.reduce(
    (current, recommendation) => applyMarketIntelligenceRecommendationToProfile(current, recommendation),
    structuredClone(profile),
  )
}

export function buildMarketIntelligenceProposal(input: {
  organizationId: string
  generatedAt: string
  proposalId: string
  beforeProfile: BusinessProfileDraftContent
  recommendations: MarketIntelligenceRecommendation[]
  profileDraftId?: string | null
}): MarketIntelligenceProposal {
  const afterProfile = applyMarketIntelligenceRecommendationsToProfile(
    input.beforeProfile,
    input.recommendations,
  )

  return {
    qaMarker: GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER,
    proposalId: input.proposalId,
    organizationId: input.organizationId,
    createdAt: input.generatedAt,
    status: input.profileDraftId ? "draft_created" : "pending_review",
    recommendations: input.recommendations,
    profileDraftId: input.profileDraftId ?? null,
    beforeProfileFingerprint: profileFingerprint(input.beforeProfile),
    afterProfileFingerprint: profileFingerprint(afterProfile),
    summary: summarizeMarketIntelligenceProposal(input.recommendations),
    explainabilityLines: input.recommendations.flatMap((row) => row.explainabilityLines).slice(0, 12),
  }
}

export function proposalFingerprint(proposal: MarketIntelligenceProposal): string {
  return JSON.stringify({
    recommendations: proposal.recommendations.map((row) => ({
      id: row.id,
      kind: row.kind,
      after: row.after,
    })),
  })
}
