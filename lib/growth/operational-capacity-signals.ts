import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthOperationalCapacityPlatformSnapshot } from "@/lib/growth/operational-capacity-platform-snapshot"
import type { GrowthLeadOperationalCapacityInput } from "@/lib/growth/operational-capacity-types"
import type { GrowthLead } from "@/lib/growth/types"

export async function fetchGrowthLeadOperationalCapacityInput(
  admin: SupabaseClient,
  lead: GrowthLead,
): Promise<GrowthLeadOperationalCapacityInput> {
  const snapshot = await fetchGrowthOperationalCapacityPlatformSnapshot(admin)

  return {
    status: lead.status,
    fit: lead.score,
    followUpAt: lead.followUpAt,
    callPriorityTier: lead.callPriorityTier,
    lastHumanTouchAt: lead.lastHumanTouchAt,
    nextBestAction: lead.nextBestAction,
    engagementTier: lead.engagementTier,
    engagementLastActivityAt: lead.engagementLastActivityAt,
    opportunityReadinessTier: lead.opportunityReadinessTier,
    opportunityAgeBucket: lead.opportunityAgeBucket,
    opportunityBlockerKeys: lead.opportunityBlockers.map((blocker) => blocker.key),
    workflowHealth: lead.workflowHealth,
    revenueProbabilityTier: lead.revenueProbabilityTier,
    forecastAttentionLevel: lead.forecastAttentionLevel,
    executivePriorityTier: lead.executivePriorityTier,
    executiveInterventionAgeBucket: lead.executiveInterventionAgeBucket,
    relationshipOwnerAttentionLevel: lead.relationshipOwnerAttentionLevel,
    intelligenceConflictSeverityScore: lead.intelligenceConflictSeverityScore,
    decisionMakerStatus: lead.decisionMakerStatus,
    opportunityBuyingSignalStrength: lead.opportunityBuyingSignalStrength,
    relationshipStrengthTier: lead.relationshipStrengthTier,
    snapshot,
    previousCapacityScore: lead.operationalCapacityScore,
    previousPressureLevel: lead.capacityPressureLevel,
    previousCapacityTier: lead.operationalCapacityTier,
    previousConstraintKeys: lead.operationalConstraints.map((entry) => entry.key),
    previousConstraintOpenedAt: lead.constraintOpenedAt,
    previousConstraintCount: lead.operationalConstraints.length,
  }
}
