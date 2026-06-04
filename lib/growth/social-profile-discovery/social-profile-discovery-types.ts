/** Phase 7.5A — Social profile discovery (client-safe types). */

export const GROWTH_SOCIAL_PROFILE_DISCOVERY_QA_MARKER =
  "growth-social-profile-discovery-7.5a-v1" as const

export const GROWTH_SOCIAL_PROFILE_DISCOVERY_MIGRATION =
  "20270715120000_growth_engine_social_profile_discovery_7_5a.sql" as const

/** Supported discovery + promotion profile types. */
export const GROWTH_SOCIAL_PROFILE_DISCOVERY_PROFILE_TYPES = [
  "linkedin_person",
  "linkedin_company",
  "twitter",
  "facebook",
  "instagram",
] as const
export type GrowthSocialProfileDiscoveryProfileType =
  (typeof GROWTH_SOCIAL_PROFILE_DISCOVERY_PROFILE_TYPES)[number]

export const GROWTH_SOCIAL_PROFILE_PERSON_TYPES = [
  "linkedin_person",
  "twitter",
  "facebook",
  "instagram",
] as const
export type GrowthSocialProfilePersonType = (typeof GROWTH_SOCIAL_PROFILE_PERSON_TYPES)[number]

export const GROWTH_SOCIAL_PROFILE_COMPANY_TYPES = [
  "linkedin_company",
  "twitter",
  "facebook",
  "instagram",
] as const
export type GrowthSocialProfileCompanyType = (typeof GROWTH_SOCIAL_PROFILE_COMPANY_TYPES)[number]

export const GROWTH_SOCIAL_PROFILE_DISCOVERY_SCOPES = ["person", "company"] as const
export type GrowthSocialProfileDiscoveryScope = (typeof GROWTH_SOCIAL_PROFILE_DISCOVERY_SCOPES)[number]

export const GROWTH_SOCIAL_PROFILE_DISCOVERY_SOURCES = [
  "website",
  "staging_contact",
  "canonical_channel",
  "manual",
  "unknown",
] as const
export type GrowthSocialProfileDiscoverySource = (typeof GROWTH_SOCIAL_PROFILE_DISCOVERY_SOURCES)[number]

export const GROWTH_SOCIAL_PROFILE_DISCOVERY_CONFIDENCE_TIERS = [
  "direct_evidence",
  "provider_evidence",
  "low",
] as const
export type GrowthSocialProfileDiscoveryConfidenceTier =
  (typeof GROWTH_SOCIAL_PROFILE_DISCOVERY_CONFIDENCE_TIERS)[number]

export const GROWTH_SOCIAL_PROFILE_DISCOVERY_VERIFICATION_STATUSES = [
  "unverified",
  "probable",
  "verified",
  "invalid",
] as const
export type GrowthSocialProfileDiscoveryVerificationStatus =
  (typeof GROWTH_SOCIAL_PROFILE_DISCOVERY_VERIFICATION_STATUSES)[number]

export const GROWTH_SOCIAL_PROFILE_DISCOVERY_RUN_STATUSES = [
  "pending",
  "running",
  "completed",
  "partial",
  "failed",
] as const
export type GrowthSocialProfileDiscoveryRunStatus =
  (typeof GROWTH_SOCIAL_PROFILE_DISCOVERY_RUN_STATUSES)[number]

/** Minimum confidence to promote into canonical profile tables (verified only). */
export const GROWTH_SOCIAL_PROFILE_DISCOVERY_PROMOTION_MIN_CONFIDENCE = 0.85 as const

/** Cap deterministic verification passes per HTTP run (timeout safety). */
export const GROWTH_SOCIAL_PROFILE_DISCOVERY_MAX_VERIFY_PER_RUN = 15 as const

export type GrowthSocialProfileDiscoveryDraftCandidate = {
  profile_type: GrowthSocialProfileDiscoveryProfileType
  profile_url: string
  normalized_profile_key: string
  source: GrowthSocialProfileDiscoverySource
  confidence: number
  confidence_tier: GrowthSocialProfileDiscoveryConfidenceTier
  provider_name: string
  discovery_source: string
  /** Staging row trusted when contact_status verified. */
  staging_trusted?: boolean
  evidence: GrowthSocialProfileDiscoveryEvidenceDraft[]
}

export type GrowthSocialProfileDiscoveryEvidenceDraft = {
  evidence_type:
    | "website_page"
    | "website_structured"
    | "social_link"
    | "staging_row"
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

export type GrowthSocialProfileDiscoveryRunResult = {
  qa_marker: typeof GROWTH_SOCIAL_PROFILE_DISCOVERY_QA_MARKER
  run_id: string
  company_id: string
  person_id: string | null
  discovery_scope: GrowthSocialProfileDiscoveryScope
  status: GrowthSocialProfileDiscoveryRunStatus
  candidate_count: number
  verified_count: number
  promoted_count: number
  candidates: GrowthSocialProfileDiscoveryCandidateSummary[]
  messages: string[]
}

export type GrowthSocialProfileDiscoveryCandidateSummary = {
  id: string
  profile_type: GrowthSocialProfileDiscoveryProfileType
  profile_url: string
  source: GrowthSocialProfileDiscoverySource
  confidence: number
  confidence_tier: GrowthSocialProfileDiscoveryConfidenceTier
  verification_status: GrowthSocialProfileDiscoveryVerificationStatus
  promotion_status: string
  promotion_reason?: string
  verification_provider?: string
  verification_reasons?: string[]
  evidence_count: number
}

export type GrowthSocialProfileDiscoveryEvidenceRecord = {
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

export type GrowthSocialProfileDiscoveryRunDetail = {
  run_id: string
  company_id: string
  person_id: string | null
  discovery_scope: string
  status: string
  candidate_count: number
  verified_count: number
  promoted_count: number
  candidates: Array<
    GrowthSocialProfileDiscoveryCandidateSummary & {
      evidence: GrowthSocialProfileDiscoveryEvidenceRecord[]
    }
  >
}

export type { GrowthSocialProfileDiscoveryOperatorStatus } from "@/lib/growth/social-profile-discovery/social-profile-discovery-runtime-types"
