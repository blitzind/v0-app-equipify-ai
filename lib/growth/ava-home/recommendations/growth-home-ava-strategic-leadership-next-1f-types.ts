/** GE-AIOS-NEXT-1F — Strategic leadership types (client-safe, presentation-only). */

export const GROWTH_AIOS_NEXT_1F_AVA_STRATEGIC_LEADERSHIP_QA_MARKER =
  "ge-aios-next-1f-ava-strategic-leadership-v1" as const

export const GROWTH_AIOS_NEXT_1F_AVA_STRATEGIC_LEADERSHIP_PRINCIPLE =
  "Ava owns business success and recommends strategy changes — the operator always decides." as const

export type GrowthHomeAvaStrategicConfidence = "high" | "moderate" | "low"

export type GrowthHomeAvaStrategicInsightKind =
  | "shift_to_outreach"
  | "shift_to_discovery"
  | "approval_bottleneck"
  | "research_bottleneck"
  | "objective_ahead"
  | "objective_complete"
  | "portfolio_quality"
  | "operator_override_pattern"
  | "organizational_learning"

export type GrowthHomeAvaStrategicInsight = {
  kind: GrowthHomeAvaStrategicInsightKind
  observation: string
  whyItMatters: string
  evidenceSources: string[]
  confidence: GrowthHomeAvaStrategicConfidence
  confidenceReason: string
  strategicMemoryLine: string | null
}

export type GrowthHomeAvaStrategicRecommendation = {
  headline: string
  summary: string
  recommendedFocusShift: string
  whatObserved: string[]
  whyItMatters: string
  supportingEvidence: string[]
  confidence: GrowthHomeAvaStrategicConfidence
  confidenceReason: string
  expectedImpact: string
  potentialRisks: string[]
  whatWouldChange: string[]
  whatRemainsTheSame: string[]
  estimatedBenefit: string | null
  recommendedObjectiveLabel: string | null
  objectivesReviewHref: string
}

export type GrowthHomeAvaStrategicLeadershipPayload = {
  qaMarker: typeof GROWTH_AIOS_NEXT_1F_AVA_STRATEGIC_LEADERSHIP_QA_MARKER
  leadershipPrinciple: typeof GROWTH_AIOS_NEXT_1F_AVA_STRATEGIC_LEADERSHIP_PRINCIPLE
  hasInsight: boolean
  title: "Strategic Insight"
  subtitle: "I've noticed something important..."
  insight: GrowthHomeAvaStrategicInsight | null
  recommendation: GrowthHomeAvaStrategicRecommendation | null
  recentWins: string[]
  whatsNext: string[]
  /** GE-AIOS-NEXT-3C — Evidence-backed executive reasoning projection */
  executiveReasoning?: import("@/lib/growth/ava-home/recommendations/growth-home-ava-executive-reasoning-next-3c-types").GrowthHomeAvaExecutiveReasoningPayload | null
}
