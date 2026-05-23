import { daysSince } from "@/lib/growth/engagement-decay"
import type {
  GrowthLeadOpportunityReadinessInput,
  GrowthOpportunityAgeBucket,
  GrowthOpportunityReadinessTier,
  GrowthOpportunityReadinessTrend,
} from "@/lib/growth/opportunity-types"

export function computeOpportunityAgeBucket(input: {
  createdAt: string
  tier: GrowthOpportunityReadinessTier
  trend: GrowthOpportunityReadinessTrend
  engagementLastActivityAt: string | null
  relationshipLastMeaningfulTouchAt: string | null
  now: Date
}): GrowthOpportunityAgeBucket {
  const ageDays = daysSince(input.createdAt, input.now)
  const lastActivity = input.engagementLastActivityAt ?? input.relationshipLastMeaningfulTouchAt
  const idleDays = lastActivity ? daysSince(lastActivity, input.now) : ageDays

  if (
    idleDays > 45 &&
    (input.trend === "declining" ||
      input.tier === "not_ready" ||
      input.tier === "developing")
  ) {
    return "stalled"
  }

  if (input.tier === "sales_ready" || input.tier === "priority_opportunity") {
    return ageDays <= 30 ? "developing" : "maturing"
  }

  if (ageDays <= 21) return "new"
  if (ageDays <= 60) return "developing"
  return "maturing"
}
