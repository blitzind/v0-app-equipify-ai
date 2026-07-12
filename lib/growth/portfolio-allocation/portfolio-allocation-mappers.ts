/**
 * SV1-2 — Map existing ranker rows into portfolio candidates (client-safe).
 * Does not re-score missions, meta, or daily queue.
 */

import type { GrowthMissionAllocationRecommendation } from "@/lib/growth/aios/growth/growth-mission-priority-types"
import type { AiOsInvestmentState } from "@/lib/growth/resource-allocation/resource-allocation-types"
import type {
  AiOsPortfolioCandidate,
  AiOsPortfolioCapacityClass,
} from "@/lib/growth/portfolio-allocation/portfolio-allocation-types"

export function mapMissionAllocationToPortfolioCandidate(input: {
  organizationId: string
  row: GrowthMissionAllocationRecommendation
  investmentState?: AiOsInvestmentState | null
  objectiveId?: string | null
  metaRecommendationScore?: number | null
  priorityBindingRank?: number | null
  priorityBindingScore?: number | null
  dailyQueueSortScore?: number | null
  researchFresh?: boolean | null
  researchStale?: boolean | null
  engagementScore?: number | null
  missionAligned?: boolean | null
}): AiOsPortfolioCandidate {
  const { row } = input
  return {
    leadId: row.leadId,
    organizationId: input.organizationId,
    missionId: row.missionId,
    objectiveId: input.objectiveId ?? null,
    companyName: row.companyName,
    investmentState: input.investmentState ?? null,
    signals: {
      missionAligned: input.missionAligned ?? true,
      missionPriorityOverall: row.priority.overallPriority,
      missionQueueBucket: row.queueBucket,
      missionAllocationStatus: row.allocationStatus,
      metaRecommendationScore: input.metaRecommendationScore ?? null,
      priorityBindingRank: input.priorityBindingRank ?? null,
      priorityBindingScore: input.priorityBindingScore ?? null,
      dailyQueueSortScore: input.dailyQueueSortScore ?? null,
      researchFresh: input.researchFresh ?? null,
      researchStale: input.researchStale ?? null,
      engagementScore: input.engagementScore ?? null,
      urgencyScore: row.priority.urgencyScore,
      opportunityValue: row.priority.businessValueScore,
    },
  }
}

export function inferPortfolioCapacityClassFromMissionType(
  missionType: string | null | undefined,
): AiOsPortfolioCapacityClass {
  switch (missionType) {
    case "enrich_account":
    case "monitor_account":
      return "website_research"
    case "prepare_outreach":
      return "sequence_preparation"
    case "identify_buying_committee":
      return "decision_maker_discovery"
    case "qualify_lead":
      return "cheap_validation"
    default:
      return "website_research"
  }
}
