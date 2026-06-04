/** Phase 7.3A — Email discovery (client-safe types). */

export const GROWTH_EMAIL_DISCOVERY_QA_MARKER = "growth-email-discovery-7.3a-v1" as const

export const GROWTH_EMAIL_DISCOVERY_MIGRATION =
  "20270711120000_growth_engine_email_discovery_7_3a.sql" as const

export const GROWTH_EMAIL_DISCOVERY_SOURCES = [
  "website",
  "staging_contact",
  "pattern",
  "pdl",
  "manual",
  "unknown",
] as const
export type GrowthEmailDiscoverySource = (typeof GROWTH_EMAIL_DISCOVERY_SOURCES)[number]

export const GROWTH_EMAIL_DISCOVERY_CONFIDENCE_TIERS = [
  "direct_evidence",
  "provider_evidence",
  "pattern_verified",
  "pattern_unverified",
  "low",
] as const
export type GrowthEmailDiscoveryConfidenceTier =
  (typeof GROWTH_EMAIL_DISCOVERY_CONFIDENCE_TIERS)[number]

export const GROWTH_EMAIL_DISCOVERY_VERIFICATION_STATUSES = [
  "unverified",
  "verified",
  "risky",
  "invalid",
  "blocked",
  "unknown",
] as const
export type GrowthEmailDiscoveryVerificationStatus =
  (typeof GROWTH_EMAIL_DISCOVERY_VERIFICATION_STATUSES)[number]

export const GROWTH_EMAIL_DISCOVERY_RUN_STATUSES = [
  "pending",
  "running",
  "completed",
  "partial",
  "failed",
] as const
export type GrowthEmailDiscoveryRunStatus = (typeof GROWTH_EMAIL_DISCOVERY_RUN_STATUSES)[number]

/** Minimum confidence to promote into growth.person_emails (with verified status). */
export const GROWTH_EMAIL_DISCOVERY_PROMOTION_MIN_CONFIDENCE = 0.85 as const

/** Cap provider verifications per HTTP run (ZeroBounce cost / timeout safety). */
export const GROWTH_EMAIL_DISCOVERY_MAX_VERIFY_PER_RUN = 12 as const

export type GrowthEmailDiscoveryDraftCandidate = {
  email: string
  normalized_email: string
  source: GrowthEmailDiscoverySource
  confidence: number
  confidence_tier: GrowthEmailDiscoveryConfidenceTier
  provider_name: string
  discovery_source: string
  evidence: GrowthEmailDiscoveryEvidenceDraft[]
}

export type GrowthEmailDiscoveryEvidenceDraft = {
  evidence_type:
    | "website_page"
    | "website_structured"
    | "staging_row"
    | "provider_response"
    | "pattern_generation"
    | "verification"
    | "operator_note"
  source_url?: string | null
  evidence_text: string
  confidence: number
  metadata?: Record<string, unknown>
}

export type GrowthEmailDiscoveryRunResult = {
  qa_marker: typeof GROWTH_EMAIL_DISCOVERY_QA_MARKER
  run_id: string
  company_id: string
  person_id: string
  status: GrowthEmailDiscoveryRunStatus
  candidate_count: number
  verified_count: number
  promoted_count: number
  candidates: GrowthEmailDiscoveryCandidateSummary[]
  messages: string[]
}

export type GrowthEmailDiscoveryCandidateSummary = {
  id: string
  email: string
  source: GrowthEmailDiscoverySource
  confidence: number
  confidence_tier: GrowthEmailDiscoveryConfidenceTier
  verification_status: GrowthEmailDiscoveryVerificationStatus
  promotion_status: string
  promotion_reason?: string
  verification_provider?: string
  verification_reasons?: string[]
  evidence_count: number
}

export type GrowthEmailDiscoveryEvidenceRecord = {
  id: string
  candidate_id: string
  evidence_type: string
  source_url: string | null
  evidence_text: string
  confidence: number
  created_at: string
}

export type GrowthEmailDiscoveryRunDetail = {
  run_id: string
  company_id: string
  person_id: string
  status: string
  candidate_count: number
  verified_count: number
  promoted_count: number
  candidates: Array<
    GrowthEmailDiscoveryCandidateSummary & {
      evidence: GrowthEmailDiscoveryEvidenceRecord[]
    }
  >
}
