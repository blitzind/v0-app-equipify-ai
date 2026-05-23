import type {
  GrowthRelationshipQueueFilter,
  GrowthRelationshipTier,
  GrowthRelationshipTrend,
} from "@/lib/growth/relationship-types"
import type { GrowthLeadStatus } from "@/lib/growth/types"

export type RelationshipQueueFilterRow = {
  status: GrowthLeadStatus
  score: number | null
  relationshipStrengthScore: number | null
  relationshipStrengthTier: GrowthRelationshipTier | null
  relationshipTrend: GrowthRelationshipTrend | null
}

const TERMINAL = new Set<GrowthLeadStatus>(["converted", "disqualified", "archived"])

export function matchesRelationshipQueueFilter(
  filter: GrowthRelationshipQueueFilter,
  row: RelationshipQueueFilterRow,
): boolean {
  if (TERMINAL.has(row.status)) return false

  switch (filter) {
    case "trusted_relationships":
      return row.relationshipStrengthTier === "trusted"
    case "strategic_relationships":
      return row.relationshipStrengthTier === "strategic"
    case "needs_relationship_building":
      return (
        (row.relationshipStrengthTier === "unknown" ||
          row.relationshipStrengthTier === "developing") &&
        (row.score ?? 0) >= 50
      )
    case "relationship_cooling":
      return (
        row.relationshipTrend === "cooling" &&
        (row.relationshipStrengthTier === "active" ||
          row.relationshipStrengthTier === "trusted" ||
          row.relationshipStrengthTier === "strategic")
      )
    default:
      return false
  }
}

export function isGrowthRelationshipCallQueueFilter(
  value: string,
): value is GrowthRelationshipQueueFilter {
  return [
    "trusted_relationships",
    "strategic_relationships",
    "needs_relationship_building",
    "relationship_cooling",
  ].includes(value)
}
