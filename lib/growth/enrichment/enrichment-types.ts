/** Growth Engine — Verification + Enrichment types (Prompt 28). Client-safe. */

export const GROWTH_VERIFICATION_ENRICHMENT_QA_MARKER =
  "growth-verification-enrichment-v1" as const

export const GROWTH_ENRICHMENT_RUN_STATUSES = [
  "pending",
  "running",
  "completed",
  "partial",
  "failed",
] as const

export type GrowthEnrichmentRunStatus = (typeof GROWTH_ENRICHMENT_RUN_STATUSES)[number]

export const GROWTH_VERIFICATION_CHANNEL_STATUSES = [
  "not_present",
  "unverified",
  "observed",
  "insufficient_evidence",
  "operator_verified",
  "rejected",
] as const

export type GrowthVerificationChannelStatus =
  (typeof GROWTH_VERIFICATION_CHANNEL_STATUSES)[number]

export const GROWTH_ENRICHMENT_ATTRIBUTION_TIERS = [
  "observed",
  "provider",
  "inferred",
] as const

export type GrowthEnrichmentAttributionTier =
  (typeof GROWTH_ENRICHMENT_ATTRIBUTION_TIERS)[number]

export type GrowthEnrichmentAttribution = {
  source: string
  provider_type: string
  provider_name: string
  tier: GrowthEnrichmentAttributionTier
  signal: string
  evidence: string
  confidence: number
}

export type GrowthEnrichmentEvidence = {
  claim: string
  evidence: string
  source: string
  tier: GrowthEnrichmentAttributionTier
}

/** Operator-visible contact verification — no raw_payload. */
export type GrowthContactVerification = {
  id: string
  created_at: string
  updated_at: string
  contact_candidate_id: string
  provider_name: string
  provider_type: string
  email_status: GrowthVerificationChannelStatus
  phone_status: GrowthVerificationChannelStatus
  linkedin_status: GrowthVerificationChannelStatus
  verification_confidence: number
  verification_reason: string
  evidence: GrowthEnrichmentEvidence[]
  source_attribution: GrowthEnrichmentAttribution[]
  metadata: Record<string, unknown>
}

/** Operator-visible company enrichment — no raw_payload. */
export type GrowthCompanyEnrichment = {
  id: string
  created_at: string
  updated_at: string
  company_candidate_id: string
  provider_name: string
  provider_type: string
  employee_estimate: string | null
  revenue_estimate: string | null
  industry: string | null
  subindustry: string | null
  technology_signals: string[]
  crm_signals: string[]
  service_signals: string[]
  location_signals: string[]
  confidence: number
  evidence: GrowthEnrichmentEvidence[]
  source_attribution: GrowthEnrichmentAttribution[]
  metadata: Record<string, unknown>
}

export type GrowthEnrichmentRun = {
  id: string
  created_at: string
  updated_at: string
  contact_candidate_id: string | null
  company_candidate_id: string | null
  created_by: string | null
  provider_names: string[]
  status: GrowthEnrichmentRunStatus
  metadata: Record<string, unknown>
}

export type GrowthVerificationEnrichmentSnapshot = {
  qa_marker: typeof GROWTH_VERIFICATION_ENRICHMENT_QA_MARKER
  schema_ready: boolean
  contact_candidate_id: string | null
  company_candidate_id: string | null
  run: GrowthEnrichmentRun | null
  contact_verifications: GrowthContactVerification[]
  company_enrichments: GrowthCompanyEnrichment[]
  provider_messages: string[]
  privacy_note: string
  /** UI summary fields */
  ui_summary: GrowthVerificationEnrichmentUiSummary
}

export type GrowthVerificationEnrichmentUiSummary = {
  email_verified_label: string
  phone_verified_label: string
  linkedin_verified_label: string
  company_confidence_label: string
  technology_signals: string[]
  industry_confidence_label: string
  enrichment_confidence_label: string
}

export const GROWTH_VERIFICATION_ENRICHMENT_PRIVACY_NOTE =
  "Verification and enrichment are evidence-backed only — no guessed emails, no fabricated LinkedIn or phones, and no automatic Revenue Queue or outreach."
