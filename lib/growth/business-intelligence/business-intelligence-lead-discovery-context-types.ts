/** GE-AIOS-8A-8 — BI → Lead Discovery context types (client-safe). */

export const GROWTH_BUSINESS_INTELLIGENCE_LEAD_DISCOVERY_QA_MARKER =
  "ge-aios-8a-8-bi-lead-discovery-context-v1" as const

export const GROWTH_BUSINESS_INTELLIGENCE_LEAD_DISCOVERY_PHASE = "GE-AIOS-8A-8" as const

export const GROWTH_BUSINESS_INTELLIGENCE_LEAD_DISCOVERY_API_PATH =
  "/api/platform/growth/business-intelligence/lead-discovery-context" as const

export const GROWTH_BUSINESS_INTELLIGENCE_REVIEW_BUSINESS_UNDERSTANDING_ADVISORY =
  "Review your business understanding first before relying on new targeting defaults." as const

export const GROWTH_BUSINESS_INTELLIGENCE_DRAFT_PENDING_ADVISORY =
  "Business Profile draft pending approval — draft values are not used for live lead discovery targeting." as const

export type LeadDiscoveryExplainabilitySource =
  | "approved_business_profile"
  | "reviewed_business_intelligence"
  | "fallback"
  | "mission"
  /** @deprecated Use approved_business_profile */
  | "growth_profile"
  /** @deprecated Use fallback */
  | "generic_fallback"

export type LeadDiscoveryExplainabilityLine = {
  id: string
  label: string
  detail: string
  source: LeadDiscoveryExplainabilitySource
  confidence?: number | null
  supporting_evidence_ids?: string[]
  explanation?: string
}

export type BusinessIntelligenceLeadDiscoveryReviewField = {
  field_key: string
  label: string
  decision: string
  confidence: number | null
  supporting_evidence_ids: string[]
  explanation: string
}

export type BusinessIntelligenceLeadDiscoverySignals = {
  has_report: boolean
  has_review_decisions: boolean
  bi_draft_pending_approval: boolean
  bi_draft_profile_id: string | null
  bi_applied_to_draft: boolean
  reviewed_fields: BusinessIntelligenceLeadDiscoveryReviewField[]
  advisory: string | null
  suggestions_only: boolean
}

export type BusinessIntelligenceLeadDiscoveryContextSlice = {
  advisory: string | null
  pending_draft: boolean
  pending_draft_profile_id: string | null
  suggestions_only: boolean
  review_enriched: boolean
}
