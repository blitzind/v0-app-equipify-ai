/** GE-AIOS-NEXT-3E — Stable recommendation-topic identity (client-safe). */

import type { GrowthHomeAvaRecommendationKind } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1a-types"

export const GROWTH_AIOS_NEXT_3E_RECOMMENDATION_TOPIC_QA_MARKER =
  "ge-aios-next-3e-recommendation-topic-identity-v1" as const

/** Canonical topics reused from NEXT-3C executive reasoning — no competing taxonomy. */
export const GROWTH_AIOS_NEXT_3E_RECOMMENDATION_TOPICS = [
  "admission_yield",
  "decision_maker_readiness",
  "operator_review",
  "pipeline_coverage",
  "research_throughput",
  "package_throughput",
  "outreach_readiness",
  "insufficient_evidence",
] as const

export type GrowthRecommendationTopic = (typeof GROWTH_AIOS_NEXT_3E_RECOMMENDATION_TOPICS)[number]

export function isGrowthRecommendationTopic(value: string | null | undefined): value is GrowthRecommendationTopic {
  return Boolean(value && (GROWTH_AIOS_NEXT_3E_RECOMMENDATION_TOPICS as readonly string[]).includes(value))
}

export function normalizeGrowthRecommendationTopic(value: string | null | undefined): GrowthRecommendationTopic | null {
  return isGrowthRecommendationTopic(value) ? value : null
}

/** Narrow fallback when explicit topic is unavailable — never infer from post-hoc Home state alone. */
export function mapRecommendationKindToTopic(
  kind: GrowthHomeAvaRecommendationKind | null | undefined,
): GrowthRecommendationTopic | null {
  switch (kind) {
    case "approval_package":
    case "waiting_on_you":
      return "operator_review"
    case "lead_decision":
    case "operator_focus":
      return "decision_maker_readiness"
    case "mission_discovery":
      return "pipeline_coverage"
    case "supervised_sales":
      return "package_throughput"
    case "work_manager":
    case "daily_queue":
      return "research_throughput"
    default:
      return null
  }
}

export function resolveGrowthRecommendationTopic(input: {
  explicitTopic?: string | null
  recommendationKind?: GrowthHomeAvaRecommendationKind | null
}): GrowthRecommendationTopic | null {
  return normalizeGrowthRecommendationTopic(input.explicitTopic) ?? mapRecommendationKindToTopic(input.recommendationKind)
}

export function growthRecommendationTopicLabel(topic: GrowthRecommendationTopic): string {
  switch (topic) {
    case "admission_yield":
      return "admission yield"
    case "decision_maker_readiness":
      return "decision-maker readiness"
    case "operator_review":
      return "operator review throughput"
    case "pipeline_coverage":
      return "pipeline coverage"
    case "research_throughput":
      return "research throughput"
    case "package_throughput":
      return "package throughput"
    case "outreach_readiness":
      return "outreach readiness"
    case "insufficient_evidence":
      return "organizational priority"
    default:
      return topic
  }
}
