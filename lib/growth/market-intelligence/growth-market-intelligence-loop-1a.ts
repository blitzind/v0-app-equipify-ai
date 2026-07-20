/** GE-AIOS-MARKET-INTELLIGENCE-LOOP-1A — Market Intelligence Loop orchestrator (client-safe). */

import { GROWTH_HOME_BUSINESS_PROFILE_SECTION_SELECTOR } from "@/lib/growth/ava-home/datamoon/growth-home-datamoon-sourcing-api-contract"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import type { AvaOrganizationalMemoryStore } from "@/lib/growth/memory/types"
import type { OrganizationalKnowledgeItem } from "@/lib/growth/memory/knowledge/organization-knowledge-types"
import {
  buildMarketIntelligenceSnapshot,
  summarizeCurrentStrategyFromProfile,
} from "@/lib/growth/market-intelligence/growth-market-intelligence-aggregator-1a"
import {
  GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER,
  type MarketIntelligenceLoopEvaluation,
  type MarketIntelligenceLoopMemory,
  type MarketIntelligenceOperatorProjection,
  type MarketIntelligenceProposal,
} from "@/lib/growth/market-intelligence/growth-market-intelligence-loop-1a-types"
import {
  emptyMarketIntelligenceLoopMemory,
  parseMarketIntelligenceLoopMemoryFromStore,
  shouldSkipMarketIntelligenceProposalCreation,
} from "@/lib/growth/market-intelligence/growth-market-intelligence-memory-1a"
import { buildMarketIntelligenceProposal } from "@/lib/growth/market-intelligence/growth-market-intelligence-proposal-1a"
import { buildMarketIntelligenceRecommendations } from "@/lib/growth/market-intelligence/growth-market-intelligence-recommendations-1a"
import { buildMarketIntelligenceSegmentMetrics } from "@/lib/growth/market-intelligence/growth-market-intelligence-segment-analytics-1a"
import type { SalesOutcome } from "@/lib/growth/specialists/execution/sales-outcome-types"
import type { GrowthLead } from "@/lib/growth/types"

export function evaluateMarketIntelligenceLoop(input: {
  organizationId: string
  generatedAt: string
  approvedProfile: BusinessProfileDraftContent | null
  validatedLearnings: OrganizationalKnowledgeItem[]
  leads: GrowthLead[]
  salesOutcomes?: SalesOutcome[]
  organizationalMemory?: AvaOrganizationalMemoryStore | null
  loopMemory?: MarketIntelligenceLoopMemory | null
}): MarketIntelligenceLoopEvaluation {
  const memory =
    input.loopMemory ??
    parseMarketIntelligenceLoopMemoryFromStore(input.organizationalMemory ?? null) ??
    emptyMarketIntelligenceLoopMemory()

  const segmentMetrics = buildMarketIntelligenceSegmentMetrics({
    leads: input.leads,
    salesOutcomes: input.salesOutcomes ?? [],
  })

  const snapshot = buildMarketIntelligenceSnapshot({
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    approvedProfile: input.approvedProfile,
    validatedLearnings: input.validatedLearnings,
    segmentMetrics,
    evidenceRefs: [],
  })

  const recommendations = buildMarketIntelligenceRecommendations({
    snapshot,
    approvedProfile: input.approvedProfile,
  })

  if (!input.approvedProfile || recommendations.length === 0) {
    return {
      qaMarker: GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER,
      snapshot,
      recommendations: [],
      proposal: null,
      shouldCreateProposal: false,
      skipReason: !input.approvedProfile
        ? "Approved Company Profile required before strategic proposals."
        : "Not enough validated evidence to propose strategic changes.",
    }
  }

  const proposalId = `mi-proposal:${input.organizationId}:${input.generatedAt.slice(0, 10)}`
  const proposal = buildMarketIntelligenceProposal({
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    proposalId,
    beforeProfile: input.approvedProfile,
    recommendations,
  })

  const skip = shouldSkipMarketIntelligenceProposalCreation({
    memory,
    proposal,
    generatedAt: input.generatedAt,
  })

  return {
    qaMarker: GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER,
    snapshot,
    recommendations,
    proposal,
    shouldCreateProposal: !skip.skip,
    skipReason: skip.reason,
  }
}

export function buildMarketIntelligenceOperatorProjection(input: {
  approvedProfile: BusinessProfileDraftContent | null
  evaluation: MarketIntelligenceLoopEvaluation
  loopMemory: MarketIntelligenceLoopMemory
}): MarketIntelligenceOperatorProjection {
  const pending = Boolean(input.loopMemory.pendingProposalId)
  const topRecommendation = input.evaluation.recommendations[0] ?? null

  return {
    qaMarker: GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER,
    currentStrategySummary: summarizeCurrentStrategyFromProfile(input.approvedProfile),
    suggestedImprovements: input.evaluation.recommendations,
    lastAcceptedImprovementSummary: input.loopMemory.lastAcceptedProposalId
      ? "Last strategic improvement was approved in Company Profile."
      : null,
    lastAcceptedAt: input.loopMemory.lastAcceptedAt,
    pendingReview: pending,
    pendingProposalSummary: pending ? input.evaluation.proposal?.summary ?? null : null,
    pendingProposalConfidencePercent: topRecommendation?.confidence.confidencePercent ?? null,
    profileDraftHref: `/#${GROWTH_HOME_BUSINESS_PROFILE_SECTION_SELECTOR}`,
    emptyMessage:
      input.evaluation.recommendations.length === 0
        ? "No validated strategic improvements to propose yet."
        : null,
  }
}

export function attachMarketIntelligenceToProposalDraft(
  proposal: MarketIntelligenceProposal,
  profileDraftId: string,
): MarketIntelligenceProposal {
  return {
    ...proposal,
    status: "draft_created",
    profileDraftId,
  }
}
