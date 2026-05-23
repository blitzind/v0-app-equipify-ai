import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { hasUsableResearch } from "@/lib/growth/call-priority"
import { fetchGrowthLeadEmailEventSummary } from "@/lib/growth/outbound/email-event-summary"
import { fetchLatestUsableGrowthLeadResearchRun } from "@/lib/growth/research-repository"
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
  }
}
