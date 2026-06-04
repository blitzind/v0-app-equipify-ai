/** Phase 7.4A — Phone discovery (client-safe types). */

export const GROWTH_PHONE_DISCOVERY_QA_MARKER = "growth-phone-discovery-7.4a-v1" as const

export const GROWTH_PHONE_DISCOVERY_MIGRATION =
  "20270713120000_growth_engine_phone_discovery_7_4a.sql" as const

export const GROWTH_PHONE_DISCOVERY_SOURCES = [
  "website",
  "staging_contact",
  "pdl",
  "canonical_channel",
  "manual",
  "unknown",
] as const
export type GrowthPhoneDiscoverySource = (typeof GROWTH_PHONE_DISCOVERY_SOURCES)[number]

export const GROWTH_PHONE_DISCOVERY_CONFIDENCE_TIERS = [
  "direct_evidence",
  "provider_evidence",
  "low",
] as const
export type GrowthPhoneDiscoveryConfidenceTier =
  (typeof GROWTH_PHONE_DISCOVERY_CONFIDENCE_TIERS)[number]

export const GROWTH_PHONE_DISCOVERY_VERIFICATION_STATUSES = [
  "unverified",
  "probable",
  "verified",
  "invalid",
] as const
export type GrowthPhoneDiscoveryVerificationStatus =
  (typeof GROWTH_PHONE_DISCOVERY_VERIFICATION_STATUSES)[number]

export const GROWTH_PHONE_DISCOVERY_RUN_STATUSES = [
  "pending",
  "running",
  "completed",
  "partial",
  "failed",
] as const
export type GrowthPhoneDiscoveryRunStatus = (typeof GROWTH_PHONE_DISCOVERY_RUN_STATUSES)[number]

export const GROWTH_PHONE_DISCOVERY_PHONE_TYPES = ["mobile", "business", "unknown"] as const
export type GrowthPhoneDiscoveryPhoneType = (typeof GROWTH_PHONE_DISCOVERY_PHONE_TYPES)[number]

/** Minimum confidence to promote into growth.person_phones (verified only). */
export const GROWTH_PHONE_DISCOVERY_PROMOTION_MIN_CONFIDENCE = 0.85 as const

/** Cap deterministic verification passes per HTTP run (timeout safety). */
export const GROWTH_PHONE_DISCOVERY_MAX_VERIFY_PER_RUN = 20 as const

export type GrowthPhoneDiscoveryDraftCandidate = {
  phone: string
  normalized_phone: string
  phone_type: GrowthPhoneDiscoveryPhoneType
  source: GrowthPhoneDiscoverySource
  confidence: number
  confidence_tier: GrowthPhoneDiscoveryConfidenceTier
  provider_name: string
  discovery_source: string
  /** Set when staging row contact_status or phone_status indicates trusted phone. */
  staging_trusted?: boolean
  evidence: GrowthPhoneDiscoveryEvidenceDraft[]
}

export type GrowthPhoneDiscoveryEvidenceDraft = {
  evidence_type:
    | "website_page"
    | "website_structured"
    | "tel_link"
    | "staging_row"
    | "provider_response"
    | "canonical_channel"
    | "verification"
    | "operator_note"
  source_url?: string | null
  source_record_id?: string | null
  extraction_method?: string | null
  evidence_text: string
  confidence: number
  metadata?: Record<string, unknown>
}

export type GrowthPhoneDiscoveryRunResult = {
  qa_marker: typeof GROWTH_PHONE_DISCOVERY_QA_MARKER
  run_id: string
  company_id: string
  person_id: string
  status: GrowthPhoneDiscoveryRunStatus
  candidate_count: number
  verified_count: number
  promoted_count: number
  candidates: GrowthPhoneDiscoveryCandidateSummary[]
  messages: string[]
}

export type GrowthPhoneDiscoveryCandidateSummary = {
  id: string
  phone: string
  source: GrowthPhoneDiscoverySource
  confidence: number
  confidence_tier: GrowthPhoneDiscoveryConfidenceTier
  verification_status: GrowthPhoneDiscoveryVerificationStatus
  promotion_status: string
  promotion_reason?: string
  verification_provider?: string
  verification_reasons?: string[]
  evidence_count: number
}

export type GrowthPhoneDiscoveryEvidenceRecord = {
  id: string
  candidate_id: string
  evidence_type: string
  source_url: string | null
  source_record_id: string | null
  extraction_method: string | null
  evidence_text: string
  confidence: number
  created_at: string
}

export type GrowthPhoneDiscoveryRunDetail = {
  run_id: string
  company_id: string
  person_id: string
  status: string
  candidate_count: number
  verified_count: number
  promoted_count: number
  candidates: Array<
    GrowthPhoneDiscoveryCandidateSummary & {
      evidence: GrowthPhoneDiscoveryEvidenceRecord[]
    }
  >
}

/** Operator rollup for infrastructure / future 7.4B (no runtime queue in 7.4A). */
export type GrowthPhoneDiscoveryOperatorStatus = {
  company_id: string
  person_id: string
  has_verified_phone: boolean
  verified_phone: string | null
  discovery_status: "none" | "completed" | "failed"
  last_run_id: string | null
  last_run_status: string | null
  last_run_at: string | null
  evidence_count: number
  can_discover: boolean
  can_view_evidence: boolean
}
