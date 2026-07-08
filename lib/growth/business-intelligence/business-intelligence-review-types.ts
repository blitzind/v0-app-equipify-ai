/** GE-AIOS-8A-7 — Business Intelligence review types (client-safe). */

export const GROWTH_BUSINESS_INTELLIGENCE_REVIEW_QA_MARKER =
  "ge-aios-8a-7-business-intelligence-review-v1" as const

export const GROWTH_BUSINESS_INTELLIGENCE_REVIEW_PHASE = "GE-AIOS-8A-7" as const

export const GROWTH_BUSINESS_INTELLIGENCE_REVIEW_SCHEMA_MIGRATION =
  "20271002140100_growth_business_intelligence_review_ge_aios_8a_7.sql" as const

export const BUSINESS_INTELLIGENCE_REVIEW_DECISIONS = [
  "approved",
  "edited",
  "dismissed",
  "marked_unknown",
  "needs_more_info",
] as const

export type BusinessIntelligenceReviewDecisionType =
  (typeof BUSINESS_INTELLIGENCE_REVIEW_DECISIONS)[number]

export const BUSINESS_INTELLIGENCE_REVIEW_FIELD_KEYS = [
  "company.company_description",
  "company.primary_offer",
  "company.products",
  "company.services",
  "market.industries_served",
  "market.geographic_markets",
  "sales.likely_buyer_personas",
  "sales.likely_pain_points",
  "company.plans_pricing",
  "company.differentiators",
] as const

export type BusinessIntelligenceReviewFieldKey =
  (typeof BUSINESS_INTELLIGENCE_REVIEW_FIELD_KEYS)[number]

export type BusinessIntelligenceReviewFieldValue = string | string[] | null

export type BusinessIntelligenceReviewDecisionRecord = {
  id: string
  organization_id: string
  business_intelligence_report_id: string
  evidence_snapshot_id: string
  field_key: BusinessIntelligenceReviewFieldKey
  original_value_json: BusinessIntelligenceReviewFieldValue
  approved_value_json: BusinessIntelligenceReviewFieldValue
  decision: BusinessIntelligenceReviewDecisionType
  confidence_at_decision: number | null
  supporting_evidence_ids: string[]
  decided_by: string | null
  decided_at: string
  metadata: Record<string, unknown>
}

export type BusinessIntelligenceReviewDecisionSummary = {
  field_key: BusinessIntelligenceReviewFieldKey
  decision: BusinessIntelligenceReviewDecisionType
  approved_value_json: BusinessIntelligenceReviewFieldValue
  decided_at: string
}

export type BusinessIntelligenceReviewProgress = {
  reviewed_count: number
  total_review_fields: number
  unresolved_contradictions: number
  missing_required_confirmations: number
  can_apply_to_profile: boolean
}

export const GROWTH_BUSINESS_INTELLIGENCE_REVIEW_PROMPT =
  "Ava researched your business. Please review what she learned." as const

export const GROWTH_BUSINESS_INTELLIGENCE_APPLY_TO_PROFILE_LABEL =
  "Update Business Profile with approved answers" as const

export function isBusinessIntelligenceReviewFieldKey(
  value: string,
): value is BusinessIntelligenceReviewFieldKey {
  return (BUSINESS_INTELLIGENCE_REVIEW_FIELD_KEYS as readonly string[]).includes(value)
}

export function reviewDecisionLabel(decision: BusinessIntelligenceReviewDecisionType): string {
  switch (decision) {
    case "approved":
      return "Approved"
    case "edited":
      return "Edited"
    case "dismissed":
      return "Dismissed"
    case "marked_unknown":
      return "Marked unknown"
    case "needs_more_info":
      return "Needs more info"
    default:
      return decision
  }
}
