/** GE-AIOS-8A-4 — Evidence-constrained BI AI recommendation schema (client-safe). */

import { z } from "zod"

export const GROWTH_BUSINESS_INTELLIGENCE_AI_QA_MARKER =
  "ge-aios-8a-4-business-intelligence-ai-v1" as const

export const GROWTH_BUSINESS_INTELLIGENCE_AI_PHASE = "GE-AIOS-8A-4" as const

export const BUSINESS_INTELLIGENCE_AI_RECOMMENDATION_CATEGORIES = [
  "ideal_customer_profile",
  "buyer_personas",
  "target_industries",
  "positioning",
  "outreach_messaging",
  "lead_discovery_strategy",
  "qualification_strategy",
  "marketing_strategy",
  "missing_information",
  "evidence_conflict",
] as const

export type BusinessIntelligenceAiRecommendationCategory =
  (typeof BUSINESS_INTELLIGENCE_AI_RECOMMENDATION_CATEGORIES)[number]

export const BUSINESS_INTELLIGENCE_AI_LOW_CONFIDENCE_THRESHOLD = 0.55 as const

export const businessIntelligenceAiRecommendationItemSchema = z.object({
  recommendation_id: z.string().min(1).max(120).optional(),
  category: z.enum(BUSINESS_INTELLIGENCE_AI_RECOMMENDATION_CATEGORIES),
  recommendation: z.string().min(10).max(2000),
  confidence: z.number().min(0).max(1),
  reasoning: z.array(z.string().min(3).max(500)).min(1).max(8),
  supporting_evidence_ids: z.array(z.string().min(1).max(120)).max(24),
  related_gap_ids: z.array(z.string().min(1).max(120)).max(12),
  requires_human_review: z.boolean(),
  editable_by_user: z.boolean().default(true),
})

export const businessIntelligenceAiModelSchema = z.object({
  recommendations: z.array(businessIntelligenceAiRecommendationItemSchema).max(24),
})

export type BusinessIntelligenceAiRecommendationModel = z.infer<
  typeof businessIntelligenceAiRecommendationItemSchema
>

export type BusinessIntelligenceAiModel = z.infer<typeof businessIntelligenceAiModelSchema>

export type BusinessIntelligenceAiRecommendation = BusinessIntelligenceAiRecommendationModel & {
  recommendation_id: string
}

export type BusinessIntelligenceAiRecommendationsResult = {
  ok: true
  recommendations: BusinessIntelligenceAiRecommendation[]
} | {
  ok: false
  error: string
  recommendations: BusinessIntelligenceAiRecommendation[]
}

export type BusinessIntelligenceAiContextField = {
  field_key: string
  value: string | string[]
  confidence: number
  supporting_evidence_ids: string[]
  source_providers: string[]
  decision_tiers: string[]
  lifecycle_status: string
  needs_review: boolean
}

export type BusinessIntelligenceAiContextGap = {
  gap_id: string
  gap_code: string
  severity: string
  title: string
  message: string
  related_fields: string[]
  requires_user_confirmation: boolean
}

export type BusinessIntelligenceAiContextPayload = {
  allowed_evidence_ids: string[]
  allowed_gap_ids: string[]
  confidence_summary: {
    overall_confidence: number
    evidence_strength: number
    freshness_strength: number
    contradiction_count: number
    unknown_count: number
    needs_review_count: number
  }
  evidence_backed_fields: BusinessIntelligenceAiContextField[]
  gaps: BusinessIntelligenceAiContextGap[]
  contradictions: Array<{
    fact_key: string
    conflicting_values: string[]
    evidence_ids: string[]
    requires_human_review: boolean
  }>
}

export type BusinessIntelligenceAiRecommendationsMetadata = {
  status: "ok" | "failed" | "skipped"
  error?: string | null
  recommendation_count?: number
}

export function recommendationHasEvidenceOrGapReference(
  recommendation: Pick<
    BusinessIntelligenceAiRecommendationModel,
    "supporting_evidence_ids" | "related_gap_ids"
  >,
): boolean {
  return recommendation.supporting_evidence_ids.length > 0 || recommendation.related_gap_ids.length > 0
}

export function validateRecommendationEvidencePolicy(input: {
  recommendation: BusinessIntelligenceAiRecommendationModel
  allowedEvidenceIds: Set<string>
  allowedGapIds: Set<string>
}): { ok: true } | { ok: false; reason: string } {
  if (!recommendationHasEvidenceOrGapReference(input.recommendation)) {
    return { ok: false, reason: "Recommendation must cite supporting_evidence_ids or related_gap_ids." }
  }

  for (const evidenceId of input.recommendation.supporting_evidence_ids) {
    if (!input.allowedEvidenceIds.has(evidenceId)) {
      return { ok: false, reason: `Unknown supporting_evidence_id: ${evidenceId}` }
    }
  }

  for (const gapId of input.recommendation.related_gap_ids) {
    if (!input.allowedGapIds.has(gapId)) {
      return { ok: false, reason: `Unknown related_gap_id: ${gapId}` }
    }
  }

  return { ok: true }
}

export function sanitizeBusinessIntelligenceAiRecommendation(
  recommendation: BusinessIntelligenceAiRecommendationModel,
  index: number,
): BusinessIntelligenceAiRecommendation {
  const requiresReview =
    recommendation.requires_human_review ||
    recommendation.confidence < BUSINESS_INTELLIGENCE_AI_LOW_CONFIDENCE_THRESHOLD

  return {
    ...recommendation,
    recommendation_id: recommendation.recommendation_id?.trim() || `bi-rec-${index + 1}`,
    editable_by_user: recommendation.editable_by_user ?? true,
    requires_human_review: requiresReview,
    supporting_evidence_ids: [...recommendation.supporting_evidence_ids],
    related_gap_ids: [...recommendation.related_gap_ids],
    reasoning: [...recommendation.reasoning],
  }
}

export function validateAndSanitizeBusinessIntelligenceAiModel(input: {
  model: BusinessIntelligenceAiModel
  allowedEvidenceIds: Set<string>
  allowedGapIds: Set<string>
}): BusinessIntelligenceAiRecommendationsResult {
  const recommendations: BusinessIntelligenceAiRecommendation[] = []

  for (const [index, item] of input.model.recommendations.entries()) {
    const policy = validateRecommendationEvidencePolicy({
      recommendation: item,
      allowedEvidenceIds: input.allowedEvidenceIds,
      allowedGapIds: input.allowedGapIds,
    })
    if (!policy.ok) {
      return { ok: false, error: policy.reason, recommendations: [] }
    }
    recommendations.push(sanitizeBusinessIntelligenceAiRecommendation(item, index))
  }

  return { ok: true, recommendations }
}
