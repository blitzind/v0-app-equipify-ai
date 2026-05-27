import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  listBuyingCommitteeSignals,
  listOpportunityRecommendations,
  listOpportunitySignals,
  listSequencePauseCandidates,
} from "@/lib/growth/opportunity-intelligence/crm-intelligence"
import { listCrmIntelligenceEvents } from "@/lib/growth/opportunity-intelligence/opportunity-events"
import {
  GROWTH_OPPORTUNITY_INTELLIGENCE_QA_MARKER,
  type GrowthOpportunityIntelligenceDashboard,
} from "@/lib/growth/opportunity-intelligence/opportunity-types"

export async function fetchGrowthOpportunityIntelligenceDashboard(
  admin: SupabaseClient,
  input?: { leadId?: string },
): Promise<GrowthOpportunityIntelligenceDashboard> {
  const [signals, recommendations, committeeExpansion, sequencePauseCandidates, recentEvents] = await Promise.all([
    listOpportunitySignals(admin, { leadId: input?.leadId, limit: 100 }),
    listOpportunityRecommendations(admin, { leadId: input?.leadId, status: "pending", limit: 50 }),
    listBuyingCommitteeSignals(admin, { leadId: input?.leadId, limit: 30 }),
    listSequencePauseCandidates(admin, { leadId: input?.leadId, limit: 30 }),
    listCrmIntelligenceEvents(admin, { leadId: input?.leadId, limit: 30 }),
  ])

  const highIntentMap = new Map<string, { leadId: string; leadLabel: string; signalCount: number; topSignal: string }>()
  for (const signal of signals) {
    const existing = highIntentMap.get(signal.leadId)
    if (!existing) {
      highIntentMap.set(signal.leadId, {
        leadId: signal.leadId,
        leadLabel: signal.leadLabel,
        signalCount: 1,
        topSignal: signal.signalType,
      })
    } else {
      existing.signalCount += 1
    }
  }

  const buyingSignals = signals.filter((signal) =>
    ["meeting_interest", "budget_signal", "pricing_interest", "proposal_request", "urgency_signal"].includes(
      signal.signalType,
    ),
  )

  return {
    qa_marker: GROWTH_OPPORTUNITY_INTELLIGENCE_QA_MARKER,
    highIntentAccounts: [...highIntentMap.values()]
      .sort((a, b) => b.signalCount - a.signalCount)
      .slice(0, 10),
    opportunitySignals: signals.slice(0, 50),
    committeeExpansion: committeeExpansion.slice(0, 20),
    recommendedActions: recommendations.slice(0, 30),
    sequencePauseCandidates: sequencePauseCandidates.filter((candidate) => candidate.status === "pending").slice(0, 20),
    buyingSignals: buyingSignals.slice(0, 30),
    recentEvents,
  }
}
