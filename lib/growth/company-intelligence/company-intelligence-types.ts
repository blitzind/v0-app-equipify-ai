/** Phase 7.6A — Company intelligence foundation (client-safe types). */

export const GROWTH_COMPANY_INTELLIGENCE_QA_MARKER =
  "growth-company-intelligence-7.6a-v1" as const

export const GROWTH_COMPANY_INTELLIGENCE_MIGRATION =
  "20270717120000_growth_engine_company_intelligence_7_6a.sql" as const

export const GROWTH_COMPANY_INTELLIGENCE_CATEGORIES = [
  "description",
  "industry",
  "sub_industry",
  "website_signal",
  "technology",
  "social_presence",
  "company_size",
  "location",
  "hiring",
  "contactability",
] as const
export type GrowthCompanyIntelligenceCategory =
  (typeof GROWTH_COMPANY_INTELLIGENCE_CATEGORIES)[number]

export const GROWTH_COMPANY_INTELLIGENCE_SOURCES = [
  "website",
  "staging_company",
  "canonical_company",
  "canonical_snapshot",
  "canonical_social",
  "manual",
  "unknown",
] as const
export type GrowthCompanyIntelligenceSource =
  (typeof GROWTH_COMPANY_INTELLIGENCE_SOURCES)[number]

export const GROWTH_COMPANY_INTELLIGENCE_CONFIDENCE_TIERS = [
  "direct_evidence",
  "provider_evidence",
  "low",
] as const
export type GrowthCompanyIntelligenceConfidenceTier =
  (typeof GROWTH_COMPANY_INTELLIGENCE_CONFIDENCE_TIERS)[number]

export const GROWTH_COMPANY_INTELLIGENCE_VERIFICATION_STATUSES = [
  "unverified",
  "probable",
  "verified",
  "invalid",
] as const
export type GrowthCompanyIntelligenceVerificationStatus =
  (typeof GROWTH_COMPANY_INTELLIGENCE_VERIFICATION_STATUSES)[number]

export const GROWTH_COMPANY_INTELLIGENCE_RUN_STATUSES = [
  "pending",
  "running",
  "completed",
  "partial",
  "failed",
] as const
export type GrowthCompanyIntelligenceRunStatus =
  (typeof GROWTH_COMPANY_INTELLIGENCE_RUN_STATUSES)[number]

export const GROWTH_COMPANY_INTELLIGENCE_EVIDENCE_TYPES = [
  "website_page",
  "website_structured",
  "schema_org",
  "meta_tag",
  "staging_row",
  "canonical_field",
  "canonical_snapshot",
  "social_profile",
  "pattern_match",
  "verification",
  "operator_note",
] as const
export type GrowthCompanyIntelligenceEvidenceType =
  (typeof GROWTH_COMPANY_INTELLIGENCE_EVIDENCE_TYPES)[number]

/** Minimum confidence to promote into canonical snapshots (verified only). */
export const GROWTH_COMPANY_INTELLIGENCE_PROMOTION_MIN_CONFIDENCE = 0.85 as const

/** Cap deterministic verification passes per HTTP run (timeout safety). */
export const GROWTH_COMPANY_INTELLIGENCE_MAX_VERIFY_PER_RUN = 40 as const

export type GrowthCompanyIntelligenceEvidenceDraft = {
  evidence_type: GrowthCompanyIntelligenceEvidenceType
  source_url?: string | null
  source_record_id?: string | null
  extraction_method?: string | null
  evidence_text: string
  confidence?: number
  metadata?: Record<string, unknown>
}

export type GrowthCompanyIntelligenceDraftFinding = {
  finding_ref: string
  intelligence_category: GrowthCompanyIntelligenceCategory
  intelligence_key: string
  normalized_intelligence_key: string
  value_text: string | null
  value_json: Record<string, unknown> | null
  source: GrowthCompanyIntelligenceSource
  confidence: number
  confidence_tier: GrowthCompanyIntelligenceConfidenceTier
  provider_name: string
  discovery_source: string
  staging_trusted?: boolean
  evidence: GrowthCompanyIntelligenceEvidenceDraft[]
}

export type GrowthCompanyIntelligenceFindingSummary = {
  finding_ref: string
  intelligence_category: GrowthCompanyIntelligenceCategory
  intelligence_key: string
  value_text: string | null
  source: GrowthCompanyIntelligenceSource
  confidence: number
  confidence_tier: GrowthCompanyIntelligenceConfidenceTier
  verification_status: GrowthCompanyIntelligenceVerificationStatus
  promotion_status: string
  promotion_reason?: string
  verification_provider: string
  verification_reasons: string[]
  evidence_count: number
}

export type GrowthCompanyIntelligenceRunResult = {
  qa_marker: typeof GROWTH_COMPANY_INTELLIGENCE_QA_MARKER
  run_id: string
  company_id: string
  status: GrowthCompanyIntelligenceRunStatus
  finding_count: number
  verified_count: number
  promoted_count: number
  findings: GrowthCompanyIntelligenceFindingSummary[]
  messages: string[]
}

export type GrowthCompanyIntelligenceRunDetail = {
  run_id: string
  company_id: string
  status: GrowthCompanyIntelligenceRunStatus
  finding_count: number
  verified_count: number
  promoted_count: number
  provider_summary: string
  started_at: string | null
  completed_at: string | null
  error_message: string | null
  findings: GrowthCompanyIntelligenceFindingSummary[]
  evidence: Array<{
    id: string
    finding_ref: string
    intelligence_category: string
    intelligence_key: string
    evidence_type: string
    source_url: string | null
    evidence_text: string
    proposed_value_text: string | null
    confidence: number
  }>
}
