/** Phase 7.7A — Buying committee intelligence foundation (client-safe types). */

export const GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER =
  "growth-buying-committee-intelligence-7.7a-v1" as const

export const GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MIGRATION =
  "20270719120000_growth_engine_buying_committee_intelligence_7_7a.sql" as const

/** Canonical members table (spec: buying committee members; distinct from Prompt 27). */
export const GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MEMBERS_TABLE =
  "buying_committee_intelligence_members" as const

export const GROWTH_BUYING_COMMITTEE_INTELLIGENCE_ROLES = [
  "economic_buyer",
  "technical_buyer",
  "champion",
  "influencer",
  "end_user",
  "executive_sponsor",
  "procurement",
  "blocker_risk_stakeholder",
] as const

export type GrowthBuyingCommitteeIntelligenceRole =
  (typeof GROWTH_BUYING_COMMITTEE_INTELLIGENCE_ROLES)[number]

export const GROWTH_BUYING_COMMITTEE_INTELLIGENCE_SOURCES = [
  "canonical_role",
  "staging_contact",
  "confirmed_decision_maker",
  "title_pattern",
  "metadata_declared",
  "manual",
  "unknown",
] as const

export type GrowthBuyingCommitteeIntelligenceSource =
  (typeof GROWTH_BUYING_COMMITTEE_INTELLIGENCE_SOURCES)[number]

export const GROWTH_BUYING_COMMITTEE_INTELLIGENCE_CONFIDENCE_TIERS = [
  "direct_evidence",
  "provider_evidence",
  "low",
] as const

export type GrowthBuyingCommitteeIntelligenceConfidenceTier =
  (typeof GROWTH_BUYING_COMMITTEE_INTELLIGENCE_CONFIDENCE_TIERS)[number]

export const GROWTH_BUYING_COMMITTEE_INTELLIGENCE_VERIFICATION_STATUSES = [
  "unverified",
  "probable",
  "verified",
  "invalid",
] as const

export type GrowthBuyingCommitteeIntelligenceVerificationStatus =
  (typeof GROWTH_BUYING_COMMITTEE_INTELLIGENCE_VERIFICATION_STATUSES)[number]

export const GROWTH_BUYING_COMMITTEE_INTELLIGENCE_RUN_STATUSES = [
  "pending",
  "running",
  "completed",
  "partial",
  "failed",
] as const

export type GrowthBuyingCommitteeIntelligenceRunStatus =
  (typeof GROWTH_BUYING_COMMITTEE_INTELLIGENCE_RUN_STATUSES)[number]

export const GROWTH_BUYING_COMMITTEE_INTELLIGENCE_EVIDENCE_TYPES = [
  "canonical_role",
  "staging_contact",
  "confirmed_decision_maker",
  "title_pattern",
  "metadata_declared",
  "verification",
  "operator_note",
] as const

export type GrowthBuyingCommitteeIntelligenceEvidenceType =
  (typeof GROWTH_BUYING_COMMITTEE_INTELLIGENCE_EVIDENCE_TYPES)[number]

export const GROWTH_BUYING_COMMITTEE_INTELLIGENCE_PROMOTION_MIN_CONFIDENCE = 0.85 as const

export const GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MAX_VERIFY_PER_RUN = 30 as const

export type GrowthBuyingCommitteeIntelligenceEvidenceDraft = {
  evidence_type: GrowthBuyingCommitteeIntelligenceEvidenceType
  source_url?: string | null
  source_record_id?: string | null
  extraction_method?: string | null
  evidence_text: string
  confidence?: number
  metadata?: Record<string, unknown>
}

export type GrowthBuyingCommitteeIntelligenceDraftAssignment = {
  assignment_ref: string
  person_id: string
  full_name: string
  job_title: string | null
  committee_role: GrowthBuyingCommitteeIntelligenceRole
  normalized_assignment_key: string
  source: GrowthBuyingCommitteeIntelligenceSource
  confidence: number
  confidence_tier: GrowthBuyingCommitteeIntelligenceConfidenceTier
  provider_name: string
  discovery_source: string
  staging_trusted?: boolean
  evidence: GrowthBuyingCommitteeIntelligenceEvidenceDraft[]
}

export type GrowthBuyingCommitteeIntelligenceAssignmentSummary = {
  assignment_ref: string
  person_id: string
  full_name: string
  job_title: string | null
  committee_role: GrowthBuyingCommitteeIntelligenceRole
  source: GrowthBuyingCommitteeIntelligenceSource
  confidence: number
  verification_status: GrowthBuyingCommitteeIntelligenceVerificationStatus
  promotion_status: string
  promotion_reason?: string
  evidence_count: number
}

export type GrowthBuyingCommitteeIntelligenceCoverage = {
  roles_present: GrowthBuyingCommitteeIntelligenceRole[]
  roles_missing: GrowthBuyingCommitteeIntelligenceRole[]
  coverage_score: number
  single_thread_risk: boolean
  verified_member_count: number
}

export type GrowthBuyingCommitteeIntelligenceRunResult = {
  run_id: string
  company_id: string
  qa_marker: typeof GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER
  member_count: number
  verified_count: number
  promoted_count: number
  coverage: GrowthBuyingCommitteeIntelligenceCoverage
  assignments: GrowthBuyingCommitteeIntelligenceAssignmentSummary[]
  messages: string[]
}

export type GrowthBuyingCommitteeIntelligenceRunDetail = {
  run_id: string
  company_id: string
  status: GrowthBuyingCommitteeIntelligenceRunStatus
  member_count: number
  verified_count: number
  promoted_count: number
  coverage_score: number
  coverage: GrowthBuyingCommitteeIntelligenceCoverage | null
  assignments: GrowthBuyingCommitteeIntelligenceAssignmentSummary[]
  evidence: Array<{
    id: string
    assignment_ref: string
    person_id: string
    committee_role: string
    evidence_type: string
    evidence_text: string
    confidence: number
  }>
}
