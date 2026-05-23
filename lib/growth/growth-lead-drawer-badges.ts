/** Client-safe helpers for Growth lead drawer action badges. */

import { isForecastRegression } from "@/lib/growth/revenue-forecast-trajectory"
import type { GrowthLead } from "@/lib/growth/types"

export function growthLeadExecutiveActionRequired(lead: GrowthLead): boolean {
  return lead.executivePriorityTier === "executive_now"
}

export function growthLeadCapacityActionRequired(lead: GrowthLead): boolean {
  return lead.operationalCapacityTier === "critical"
}

export function growthLeadRevenueActionRequired(lead: GrowthLead): boolean {
  if (lead.revenueProbabilityTier === "commit_candidate") return true
  return isForecastRegression({
    previousScore: lead.revenueProbabilityPreviousScore,
    currentScore: lead.revenueProbabilityScore ?? 0,
    previousTier: null,
    currentTier: lead.revenueProbabilityTier ?? "unlikely",
    trajectory: lead.revenueTrajectory,
  })
}

export function growthLeadOpportunityActionRequired(lead: GrowthLead): boolean {
  return lead.opportunityReadinessTier === "priority_opportunity"
}

export function growthLeadRelationshipActionRequired(lead: GrowthLead): boolean {
  return lead.relationshipTrend === "cooling"
}
