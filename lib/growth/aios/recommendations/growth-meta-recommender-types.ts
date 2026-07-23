/** GE-AI-2F — Meta-Recommender read model (client-safe). */

import type { GrowthAiOsAutonomyPolicyReadModel } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-types"

export const GROWTH_AIOS_GE_AI_2F_PHASE = "GE-AI-2F" as const

export const GROWTH_META_RECOMMENDER_QA_MARKER = "growth-ge-ai-2f-meta-recommender-v1" as const

export const GROWTH_META_RECOMMENDER_RUNTIME_RULE =
  "Meta-Recommender is read-only intelligence coordination — it normalizes existing scoring and recommendation signals without executing actions, mutating Core records, sending outbound, or bypassing Growth Autonomy or human approval." as const

/** AVA-GROWTH-OPERATOR-1B — Meta-Recommender defers per-opportunity execution to Canonical Decision Engine 1A. */
export const GROWTH_META_RECOMMENDER_AUTHORITY_ROLE =
  "Portfolio optimizer and cross-signal synthesizer — never per-opportunity execution authority. Lead-scoped recommendations are advisory overlays; Canonical Decision Engine 1A owns next action, ownership, and escalation." as const

export const GROWTH_META_RECOMMENDER_RANKING_FORMULA =
  "score = impact * 0.35 + urgency * 0.25 + confidence * 0.25 - effort * 0.15 (all dimensions normalized 0–100)" as const

export const GROWTH_META_RECOMMENDATION_SCOPES = [
  "lead",
  "company",
  "person",
  "objective",
  "campaign",
  "sequence",
  "meeting",
  "call",
  "customer",
  "system",
] as const

export type GrowthMetaRecommendationScope = (typeof GROWTH_META_RECOMMENDATION_SCOPES)[number]

export const GROWTH_META_RECOMMENDATION_TYPES = [
  "prioritize",
  "research",
  "qualify",
  "prepare_outreach",
  "prepare_meeting",
  "follow_up",
  "call",
  "sms",
  "email",
  "video",
  "pause",
  "escalate",
  "review",
  "abandon",
  "optimize",
  "monitor",
] as const

export type GrowthMetaRecommendationType = (typeof GROWTH_META_RECOMMENDATION_TYPES)[number]

export type GrowthMetaRecommendationEvidence = {
  source: string
  label: string
  value?: string | number | boolean
  confidence?: number
}

export type GrowthMetaRecommendationSuggestedAction = {
  label: string
  actionType: string
  requiresHumanApproval: boolean
  route?: string
}

export type GrowthMetaRecommendationPolicy = {
  requiresHumanApproval: boolean
  autonomyCapability?: string
  blockedReason?: string
}

export type GrowthMetaRecommendation = {
  id: string
  organizationId: string
  scope: GrowthMetaRecommendationScope
  subjectId?: string
  recommendationType: GrowthMetaRecommendationType
  title: string
  summary: string
  confidence: number
  urgency: number
  impact: number
  effort: number
  score: number
  evidence: GrowthMetaRecommendationEvidence[]
  suggestedAction?: GrowthMetaRecommendationSuggestedAction
  policy: GrowthMetaRecommendationPolicy
  createdAt: string
}

export type GrowthMetaRecommenderRevenueOperatorBinding = {
  topRecommendationIds: string[]
  alignedOrchestrationIds: string[]
  summary: string
  readOnly: true
}

export type GrowthMetaRecommenderReadModel = {
  readOnly: true
  qaMarker: typeof GROWTH_META_RECOMMENDER_QA_MARKER
  generatedAt: string
  rule: typeof GROWTH_META_RECOMMENDER_RUNTIME_RULE
  authorityRole: typeof GROWTH_META_RECOMMENDER_AUTHORITY_ROLE
  rankingFormula: typeof GROWTH_META_RECOMMENDER_RANKING_FORMULA
  topRecommendations: GrowthMetaRecommendation[]
  recommendations: GrowthMetaRecommendation[]
  sourcesIncluded: string[]
  sourcesFailed: Array<{ source: string; message: string }>
  summary: {
    total: number
    requiringApproval: number
    byScope: Partial<Record<GrowthMetaRecommendationScope, number>>
  }
  revenueOperatorBinding: GrowthMetaRecommenderRevenueOperatorBinding
  autonomyPolicySource?: string
}

export type GrowthMetaRecommenderPolicyContext = Pick<
  GrowthAiOsAutonomyPolicyReadModel,
  "emergencyStopActive" | "autonomyEnabled" | "controlPlaneHref"
>
