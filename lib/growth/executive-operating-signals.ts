import "server-only"

import type { GrowthLeadExecutiveOperatingInput } from "@/lib/growth/executive-operating-types"
import type { GrowthLead } from "@/lib/growth/types"

export function fetchGrowthLeadExecutiveOperatingInput(
  lead: GrowthLead,
): GrowthLeadExecutiveOperatingInput {
  return {
    status: lead.status,
    fit: lead.score,
    assignedTo: lead.assignedTo,
    momentumTier: lead.momentumTier,
    momentumScore: lead.momentumScore,
    workflowHealth: lead.workflowHealth,
    engagementScore: lead.engagementScore,
    engagementTier: lead.engagementTier,
    relationshipStrengthTier: lead.relationshipStrengthTier,
    relationshipTrend: lead.relationshipTrend,
    relationshipOwnerAttentionLevel: lead.relationshipOwnerAttentionLevel,
    opportunityReadinessScore: lead.opportunityReadinessScore,
    opportunityReadinessTier: lead.opportunityReadinessTier,
    opportunityBuyingSignalStrength: lead.opportunityBuyingSignalStrength,
    opportunityBlockerKeys: lead.opportunityBlockers.map((blocker) => blocker.key),
    revenueProbabilityScore: lead.revenueProbabilityScore,
    revenueProbabilityTier: lead.revenueProbabilityTier,
    revenueProbabilityConfidence: lead.revenueProbabilityConfidence,
    revenueTrajectory: lead.revenueTrajectory,
    revenueProbabilityPreviousScore: lead.revenueProbabilityPreviousScore,
    revenueProbabilityVolatility: lead.revenueProbabilityVolatility,
    forecastAttentionLevel: lead.forecastAttentionLevel,
    decisionMakerStatus: lead.decisionMakerStatus,
    previousExecutiveScore: lead.executivePriorityScore,
    previousExecutiveTier: lead.executivePriorityTier,
    previousConflictCount: lead.intelligenceConflicts.length,
    previousInterventionOpenedAt: lead.executiveInterventionOpenedAt,
  }
}
