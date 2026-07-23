/** AVA-GROWTH-OPERATOR-1E — Server loader composing existing intelligence systems (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthClosedLoopLearningReadModel } from "@/lib/growth/aios/learning/growth-closed-loop-learning-service"
import { synthesizeGrowthExecutiveGrowthIntelligence } from "@/lib/growth/aios/growth-intelligence/growth-executive-growth-intelligence-synthesizer-1e"
import type { GrowthExecutiveGrowthIntelligenceReadModel } from "@/lib/growth/aios/growth-intelligence/growth-executive-growth-intelligence-types-1e"
import { evaluateMarketIntelligenceLoop } from "@/lib/growth/market-intelligence/growth-market-intelligence-loop-1a"
import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import type { GrowthPortfolioManagerSnapshot } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import type { GrowthHomeSalesOutcomesPayload } from "@/lib/growth/specialists/execution/sales-outcome-types"
import type { GrowthOrganizationalEvidenceCompletenessSnapshot } from "@/lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-next-3b-types"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import type { OrganizationalKnowledgeItem } from "@/lib/growth/memory/knowledge/organization-knowledge-types"
import type { GrowthLead } from "@/lib/growth/types"

export async function buildGrowthExecutiveGrowthIntelligenceReadModel(input: {
  admin: SupabaseClient
  organizationId: string
  generatedAt: string
  approvedProfile: BusinessProfileDraftContent | null
  validatedLearnings?: OrganizationalKnowledgeItem[]
  portfolioLeads?: GrowthLead[]
  salesOutcomes?: GrowthHomeSalesOutcomesPayload | null
  portfolioManager?: GrowthPortfolioManagerSnapshot | null
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
  organizationalEvidence?: GrowthOrganizationalEvidenceCompletenessSnapshot | null
}): Promise<GrowthExecutiveGrowthIntelligenceReadModel> {
  const [closedLoop, marketEvaluation] = await Promise.all([
    fetchGrowthClosedLoopLearningReadModel(input.admin, {
      organizationId: input.organizationId,
      generatedAt: input.generatedAt,
    }).catch(() => null),
    Promise.resolve(
      evaluateMarketIntelligenceLoop({
        organizationId: input.organizationId,
        generatedAt: input.generatedAt,
        approvedProfile: input.approvedProfile,
        validatedLearnings: input.validatedLearnings ?? [],
        leads: input.portfolioLeads ?? [],
        salesOutcomes: input.salesOutcomes?.outcomes ?? [],
      }),
    ),
  ])

  return synthesizeGrowthExecutiveGrowthIntelligence({
    generatedAt: input.generatedAt,
    closedLoopInsights: closedLoop?.insights ?? [],
    marketIntelligenceRecommendations: marketEvaluation.recommendations,
    segmentMetrics: marketEvaluation.snapshot.segmentPerformance,
    portfolio: input.portfolioManager,
    missionDiscovery: input.missionDiscovery,
    organizationalEvidence: input.organizationalEvidence,
    salesOutcomes: input.salesOutcomes,
  })
}
