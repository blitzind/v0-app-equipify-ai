import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { hasUsableResearch } from "@/lib/growth/call-priority"
import { fetchGrowthLeadEmailEventSummary } from "@/lib/growth/outbound/email-event-summary"
import { buildLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-influence-context"
import { fetchLatestUsableGrowthLeadResearchRun } from "@/lib/growth/research-repository"
import { fetchPendingOpportunityRecommendationScore } from "@/lib/growth/revenue-workflow/revenue-workflow-signals"
import { readRevenueReadinessFromLeadMetadata } from "@/lib/growth/revenue-workflow/revenue-workflow-types"
import type { GrowthLeadRevenueForecastInput } from "@/lib/growth/revenue-forecast-types"
import type { GrowthLead } from "@/lib/growth/types"

export async function fetchGrowthLeadRevenueForecastInput(
  admin: SupabaseClient,
  lead: GrowthLead,
): Promise<GrowthLeadRevenueForecastInput> {
  const emailSummary = await fetchGrowthLeadEmailEventSummary(admin, lead.id, lead.contactEmail)
  const latestRun = lead.latestResearchRunId
    ? await fetchLatestUsableGrowthLeadResearchRun(admin, lead.id)
    : null
  const [memory, opportunityRecommendationScore] = await Promise.all([
    buildLeadMemoryInfluenceContext(admin, lead.id).catch(() => null),
    fetchPendingOpportunityRecommendationScore(admin, lead.id),
  ])
  const revenueReadiness = readRevenueReadinessFromLeadMetadata(lead.metadata)

  return {
    status: lead.status,
    fit: lead.score,
    decisionMakerStatus: lead.decisionMakerStatus,
    workflowHealth: lead.workflowHealth,
    momentumTier: lead.momentumTier,
    engagementScore: lead.engagementScore,
    engagementTier: lead.engagementTier,
    relationshipStrengthScore: lead.relationshipStrengthScore,
    relationshipStrengthTier: lead.relationshipStrengthTier,
    relationshipTrend: lead.relationshipTrend,
    opportunityReadinessScore: lead.opportunityReadinessScore,
    opportunityReadinessTier: lead.opportunityReadinessTier,
    opportunityReadinessConfidence: lead.opportunityReadinessConfidence,
    opportunityReadinessTrend: lead.opportunityReadinessTrend,
    opportunityBuyingSignalStrength: lead.opportunityBuyingSignalStrength,
    opportunityBlockerKeys: lead.opportunityBlockers.map((blocker) => blocker.key),
    opportunityAcceleratorCount: lead.opportunityAccelerators.length,
    hasPositiveReply: emailSummary.latestReplyClassification === "interested",
    connectedCallCount: lead.connectedCallCount,
    hasUsableResearch: hasUsableResearch(lead.lastResearchedAt, lead.latestResearchRunId),
    researchConfidence: latestRun?.researchConfidence ?? null,
    engagementComputedAt: lead.engagementComputedAt,
    relationshipComputedAt: lead.relationshipComputedAt,
    opportunityReadinessComputedAt: lead.opportunityReadinessComputedAt,
    previousScore: lead.revenueProbabilityScore,
    previousTier: lead.revenueProbabilityTier,
    previousConfidence: lead.revenueProbabilityConfidence,
    revenueReadinessScore: revenueReadiness?.score ?? null,
    revenueReadinessTier: revenueReadiness?.tier ?? null,
    opportunityRecommendationScore,
    memoryCoverageScore: memory?.memoryCoverageScore ?? null,
    commitmentCount: memory?.commitmentSummaries?.length ?? 0,
    unresolvedObjectionCount: memory?.unresolvedObjectionCount ?? 0,
  }
}
