import { highestConfidenceLevel } from "@/lib/growth/lead-memory/memory-types"
import type {
  GrowthLeadMemoryCategory,
  GrowthLeadMemoryEvent,
  GrowthMemoryConfidence,
  GrowthRelationshipStage,
} from "@/lib/growth/lead-memory/memory-types"

export function inferRelationshipStage(input: {
  events: Array<{ memoryCategory: GrowthLeadMemoryCategory; confidence: GrowthMemoryConfidence }>
  hasActiveOpportunity?: boolean
  isCustomer?: boolean
  isInactive?: boolean
  engagementTier?: string
}): GrowthRelationshipStage {
  if (input.isCustomer) return "customer"
  if (input.isInactive) return "inactive"
  if (input.hasActiveOpportunity) return "opportunity"

  const categories = new Set(input.events.map((event) => event.memoryCategory))
  const hasHighConfidenceBuying = input.events.some(
    (event) =>
      (event.memoryCategory === "buying_signal" || event.memoryCategory === "meeting_signal") &&
      (event.confidence === "high" || event.confidence === "verified"),
  )
  const hasEvaluatingSignals =
    categories.has("budget_signal") ||
    categories.has("timeline_signal") ||
    categories.has("decision_authority") ||
    categories.has("committee_member")

  if (hasHighConfidenceBuying && hasEvaluatingSignals) return "evaluating"
  if (hasHighConfidenceBuying || categories.has("engagement_pattern")) return "engaged"
  if (categories.size > 0 || input.engagementTier === "warming") return "aware"
  return "unknown"
}

export function computeProgressionScore(input: {
  eventCount: number
  buyingSignalCount: number
  committeeCount: number
  highestConfidence: GrowthMemoryConfidence
  relationshipStage: GrowthRelationshipStage
}): number {
  const stageBase: Record<GrowthRelationshipStage, number> = {
    unknown: 5,
    aware: 20,
    engaged: 40,
    evaluating: 60,
    opportunity: 75,
    customer: 90,
    inactive: 10,
  }
  let score = stageBase[input.relationshipStage]
  score += Math.min(20, input.eventCount * 2)
  score += Math.min(15, input.buyingSignalCount * 5)
  score += Math.min(10, input.committeeCount * 4)
  if (input.highestConfidence === "verified") score += 8
  else if (input.highestConfidence === "high") score += 5
  return Math.min(100, Math.round(score))
}

export function computeEngagementTrend(input: {
  recentEventCount: number
  priorEventCount: number
  hasRiskSignals: boolean
}): "improving" | "stable" | "cooling" | "declining" {
  if (input.hasRiskSignals) return "declining"
  if (input.recentEventCount > input.priorEventCount + 1) return "improving"
  if (input.recentEventCount + 1 < input.priorEventCount) return "cooling"
  return "stable"
}

export function computeMemoryCoverageScore(input: {
  eventCount: number
  objectionCount: number
  preferenceCount: number
  committeeCount: number
  categoryCount: number
}): number {
  const categoryCoverage = Math.min(40, input.categoryCount * 8)
  const depth = Math.min(35, input.eventCount * 3)
  const breadth = Math.min(25, (input.objectionCount + input.preferenceCount + input.committeeCount) * 5)
  return Math.min(100, Math.round(categoryCoverage + depth + breadth))
}

export function extractTopSignals(events: GrowthLeadMemoryEvent[], limit = 5): string[] {
  return events.slice(0, limit).map((event) => `${event.title}: ${event.evidenceSnippet.slice(0, 80)}`)
}

export function extractRiskFlags(events: GrowthLeadMemoryEvent[]): string[] {
  return events
    .filter((event) => event.memoryCategory === "risk_signal" || event.memoryCategory === "objection")
    .slice(0, 5)
    .map((event) => event.title)
}

export function stageDistribution(
  profiles: Array<{ relationshipStage: GrowthRelationshipStage }>,
): Record<GrowthRelationshipStage, number> {
  const counts: Record<GrowthRelationshipStage, number> = {
    unknown: 0,
    aware: 0,
    engaged: 0,
    evaluating: 0,
    opportunity: 0,
    customer: 0,
    inactive: 0,
  }
  for (const profile of profiles) {
    counts[profile.relationshipStage] += 1
  }
  return counts
}

export function aggregateHighestConfidence(events: Array<{ confidence: GrowthMemoryConfidence }>): GrowthMemoryConfidence {
  return highestConfidenceLevel(events.map((event) => event.confidence))
}
