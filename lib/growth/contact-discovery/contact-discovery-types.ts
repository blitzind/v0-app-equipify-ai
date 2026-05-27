/** Growth Engine — Contact Discovery + Buying Committee types (Prompt 27). Client-safe. */

import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"

export const GROWTH_CONTACT_DISCOVERY_QA_MARKER = "growth-contact-discovery-v1" as const

export const GROWTH_CONTACT_DISCOVERY_RUN_STATUSES = [
  "pending",
  "running",
  "completed",
  "partial",
  "failed",
] as const

export type GrowthContactDiscoveryRunStatus =
  (typeof GROWTH_CONTACT_DISCOVERY_RUN_STATUSES)[number]

export const GROWTH_CONTACT_VERIFICATION_STATES = [
  "unverified",
  "operator_verified",
  "rejected",
  "insufficient_evidence",
] as const

export type GrowthContactVerificationState =
  (typeof GROWTH_CONTACT_VERIFICATION_STATES)[number]

export const GROWTH_BUYING_COMMITTEE_ROLES = [
  "economic_buyer",
  "decision_maker",
  "technical_buyer",
  "champion",
  "operator",
  "owner",
] as const

export type GrowthBuyingCommitteeRole = (typeof GROWTH_BUYING_COMMITTEE_ROLES)[number]

export const GROWTH_BUYING_COMMITTEE_TYPES = [
  "initial",
  "expansion",
  "evaluation",
] as const

export type GrowthBuyingCommitteeType = (typeof GROWTH_BUYING_COMMITTEE_TYPES)[number]

export type GrowthContactDiscoveryAttribution = {
  source: string
  provider_type: string
  provider_name: string
  signal: string
  evidence: string
  confidence: number
}

export type GrowthContactDiscoveryEvidence = {
  claim: string
  evidence: string
  source: string
}

export type GrowthContactCandidate = {
  id: string
  created_at: string
  updated_at: string
  company_candidate_id: string
  provider_name: string
  provider_type: string
  full_name: string
  first_name: string | null
  last_name: string | null
  job_title: string | null
  department: string | null
  seniority: string | null
  linkedin_url: string | null
  email: string | null
  phone: string | null
  verification_state: GrowthContactVerificationState
  confidence: number
  source_attribution: GrowthContactDiscoveryAttribution[]
  evidence: GrowthContactDiscoveryEvidence[]
  dedupe_hash: string
  metadata: Record<string, unknown>
}

export type GrowthContactDiscoveryRun = {
  id: string
  created_at: string
  updated_at: string
  company_candidate_id: string
  created_by: string | null
  provider_names: string[]
  status: GrowthContactDiscoveryRunStatus
  candidate_count: number
  error_message: string | null
  metadata: Record<string, unknown>
}

export type GrowthBuyingCommittee = {
  id: string
  company_id: string
  committee_type: GrowthBuyingCommitteeType
  coverage_score: number
  decision_maker_found: boolean
  economic_buyer_found: boolean
  technical_buyer_found: boolean
  champion_found: boolean
  metadata: Record<string, unknown>
}

export type GrowthBuyingCommitteeMember = {
  committee_id: string
  contact_candidate_id: string
  committee_role: GrowthBuyingCommitteeRole
  confidence: number
}

export type GrowthBuyingCommitteeAssessment = {
  committee: GrowthBuyingCommittee
  members: GrowthBuyingCommitteeMember[]
  contacts: GrowthContactCandidate[]
  single_thread_risk: boolean
  committee_completeness: number
  committee_confidence: number
  missing_roles: GrowthBuyingCommitteeRole[]
}

export type GrowthContactDiscoverySnapshot = {
  qa_marker: typeof GROWTH_CONTACT_DISCOVERY_QA_MARKER
  schema_ready: boolean
  schema_health?: GrowthSchemaHealthSummary | null
  company_candidate_id: string
  run: GrowthContactDiscoveryRun | null
  contacts: GrowthContactCandidate[]
  buying_committee: GrowthBuyingCommitteeAssessment | null
  provider_messages: string[]
  privacy_note: string
}

export const GROWTH_CONTACT_DISCOVERY_PRIVACY_NOTE =
  "Contact candidates are infrastructure-only — no guessed emails, no fabricated LinkedIn or phones, no auto verification, and no automatic Lead Inbox creation."
