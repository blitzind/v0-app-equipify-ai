/** GE-AIOS-MARKET-INTELLIGENCE-LOOP-1A — Scheduler tick for continuous learning (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { fetchOrganizationMemoryStore } from "@/lib/growth/memory/storage/organization-memory-repository"
import { fetchOrganizationKnowledgeStore } from "@/lib/growth/memory/knowledge/organization-knowledge-repository"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import {
  evaluateMarketIntelligenceLoop,
} from "@/lib/growth/market-intelligence/growth-market-intelligence-loop-1a"
import {
  marketIntelligenceLoopMemoryPreferencePayload,
  parseMarketIntelligenceLoopMemoryFromStore,
  recordMarketIntelligenceEvaluationMemory,
} from "@/lib/growth/market-intelligence/growth-market-intelligence-memory-1a"
import { applyMarketIntelligenceProposalToBusinessProfileDraft } from "@/lib/growth/market-intelligence/growth-market-intelligence-proposal-server-1a"
import { GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER } from "@/lib/growth/market-intelligence/growth-market-intelligence-loop-1a-types"
import { upsertOrganizationMemoryPreferences } from "@/lib/growth/memory/storage/organization-memory-repository"
import { mapWithBoundedConcurrency } from "@/lib/growth/runtime-guardrails/growth-bounded-concurrency"
import { GROWTH_OBJECTIVE_SCHEDULER_ORG_FETCH_LIMIT } from "@/lib/growth/relationship/relationship-scale-limits"

export type MarketIntelligenceSchedulerTickResult = {
  qaMarker: typeof GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER
  organizationId: string
  evaluated: boolean
  proposalCreated: boolean
  skipReason: string | null
  profileDraftId: string | null
}

export async function tickMarketIntelligenceLoopForScheduler(
  admin: SupabaseClient,
  input: {
    organizationIds: string[]
    generatedAt?: string
    maxOrganizations?: number
  },
): Promise<{ qaMarker: typeof GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER; results: MarketIntelligenceSchedulerTickResult[] }> {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const organizationIds = input.organizationIds.slice(
    0,
    input.maxOrganizations ?? GROWTH_OBJECTIVE_SCHEDULER_ORG_FETCH_LIMIT,
  )

  const results = await mapWithBoundedConcurrency(organizationIds, 2, async (organizationId) => {
    try {
      const [snapshot, approvedProfileRow, knowledgeStore, memoryStore] = await Promise.all([
        buildGrowthAutonomousPortfolioWorkSnapshot(admin, { organizationId, generatedAt }),
        getActiveApprovedBusinessProfile(admin, organizationId).catch(() => null),
        fetchOrganizationKnowledgeStore(admin, organizationId).catch(() => null),
        fetchOrganizationMemoryStore(admin, organizationId).catch(() => null),
      ])

      if (!snapshot) {
        return {
          qaMarker: GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER,
          organizationId,
          evaluated: false,
          proposalCreated: false,
          skipReason: "Portfolio snapshot unavailable.",
          profileDraftId: null,
        }
      }

      const loopMemory = parseMarketIntelligenceLoopMemoryFromStore(memoryStore)
      const evaluation = evaluateMarketIntelligenceLoop({
        organizationId,
        generatedAt,
        approvedProfile: approvedProfileRow?.profile ?? null,
        validatedLearnings: knowledgeStore?.items ?? [],
        leads: snapshot.leads,
        salesOutcomes: snapshot.salesOutcomes?.outcomes ?? [],
        organizationalMemory: memoryStore,
        loopMemory,
      })

      const evaluatedMemory = recordMarketIntelligenceEvaluationMemory({
        memory: loopMemory,
        generatedAt,
      })
      await upsertOrganizationMemoryPreferences(admin, {
        organizationId,
        preferences: [marketIntelligenceLoopMemoryPreferencePayload(evaluatedMemory)],
        generatedAt,
      })

      if (!evaluation.shouldCreateProposal || !evaluation.proposal) {
        return {
          qaMarker: GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER,
          organizationId,
          evaluated: true,
          proposalCreated: false,
          skipReason: evaluation.skipReason,
          profileDraftId: null,
        }
      }

      const applied = await applyMarketIntelligenceProposalToBusinessProfileDraft(admin, {
        organizationId,
        createdBy: null,
        proposal: evaluation.proposal,
        generatedAt,
      })

      logGrowthEngine("market_intelligence_loop.proposal_created", {
        organizationId,
        profileDraftId: applied.profileId,
        recommendationCount: evaluation.recommendations.length,
      })

      return {
        qaMarker: GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER,
        organizationId,
        evaluated: true,
        proposalCreated: true,
        skipReason: null,
        profileDraftId: applied.profileId,
      }
    } catch (error) {
      logGrowthEngine("market_intelligence_loop.tick_failed", {
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      })
      return {
        qaMarker: GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER,
        organizationId,
        evaluated: false,
        proposalCreated: false,
        skipReason: error instanceof Error ? error.message : "Unknown error",
        profileDraftId: null,
      }
    }
  })

  return { qaMarker: GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER, results }
}
