import type { GrowthEngagementQueueFilter, GrowthEngagementTier } from "@/lib/growth/engagement-types"
import type { GrowthDecisionMakerPresenceStatus } from "@/lib/growth/decision-maker-types"
import { daysSince } from "@/lib/growth/engagement-decay"
import type { GrowthLeadStatus } from "@/lib/growth/types"

export type EngagementQueueFilterRow = {
  status: GrowthLeadStatus
  engagementScore: number | null
  engagementTier: GrowthEngagementTier | null
  engagementLastActivityAt: string | null
  decisionMakerStatus: GrowthDecisionMakerPresenceStatus | null
}

const TERMINAL = new Set<GrowthLeadStatus>(["converted", "disqualified", "archived"])

export function matchesEngagementQueueFilter(
  filter: GrowthEngagementQueueFilter,
  row: EngagementQueueFilterRow,
  now: Date = new Date(),
): boolean {
  if (TERMINAL.has(row.status)) return false

  switch (filter) {
    case "hot":
      return row.engagementTier === "hot"
    case "engaged":
      return row.engagementTier === "engaged" || row.engagementTier === "hot"
    case "dormant":
      return (
        !row.engagementLastActivityAt || daysSince(row.engagementLastActivityAt, now) > 30
      )
    case "recently_active":
      return Boolean(row.engagementLastActivityAt && daysSince(row.engagementLastActivityAt, now) <= 7)
    case "decision_maker_engaged":
      return (
        (row.decisionMakerStatus === "confirmed" || row.decisionMakerStatus === "verified_contactable") &&
        (row.engagementTier === "warming" ||
          row.engagementTier === "engaged" ||
          row.engagementTier === "hot")
      )
    default:
      return false
  }
}

export function isGrowthCallQueueFilter(value: string): value is import("@/lib/growth/call-types").GrowthCallQueueFilter {
  return [
    "call_ready",
    "high_fit",
    "needs_research",
    "needs_website_research",
    "hot",
    "engaged",
    "dormant",
    "recently_active",
    "decision_maker_engaged",
    "trusted_relationships",
    "strategic_relationships",
    "needs_relationship_building",
    "relationship_cooling",
    "priority_opportunities",
    "sales_ready",
    "needs_qualification",
    "blocked_opportunities",
    "commit_candidates",
    "forecasted",
    "probable",
    "low_confidence_forecast",
    "executive_now",
    "executive_priority",
    "leadership_bottlenecks",
    "intelligence_conflicts",
  ].includes(value)
}
