/** Prospect Search — Growth Engine intelligence overlay types (Phase 7.PS-A). Client-safe. */

import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"
import type { GrowthBuyingCommitteeIntelligenceRole } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"

export const GROWTH_PROSPECT_SEARCH_ENGINE_INTELLIGENCE_QA_MARKER =
  "growth-prospect-search-engine-intelligence-7-ps-a-v1" as const

export type GrowthProspectSearchCompanyIntelligenceSnapshot = {
  intelligence_category: string
  intelligence_key: string
  value_text: string | null
  confidence: number
  verification_status: string
}

export type GrowthProspectSearchCompanyIntelligenceRead = {
  has_verified_intelligence: boolean
  snapshot_count: number
  categories_present: string[]
  discovery_status: string
  snapshots: GrowthProspectSearchCompanyIntelligenceSnapshot[]
}

export type GrowthProspectSearchBuyingCommitteeMember = {
  person_id: string
  full_name: string
  job_title: string | null
  committee_role: GrowthBuyingCommitteeIntelligenceRole | string
  confidence: number
}

export type GrowthProspectSearchBuyingCommitteeRead = {
  member_count: number
  verified_member_count: number
  coverage_score: number
  single_thread_risk: boolean
  roles_present: string[]
  roles_missing: string[]
  members: GrowthProspectSearchBuyingCommitteeMember[]
  /** Phase 7.PS-HP — evidence-backed committee completeness (0–1). */
  committee_completeness?: number
  missing_critical_roles?: string[]
  detected_role_labels?: string[]
  committee_readiness?: "ready" | "partial" | "gap" | "blocked"
  outreach_prioritization_boost?: number
}

export type GrowthProspectSearchVerifiedChannelPerson = {
  person_id: string
  has_verified_email: boolean
  verified_email: string | null
  has_verified_phone: boolean
  verified_phone: string | null
  has_verified_profile: boolean
  verified_profile_url: string | null
}

export type GrowthProspectSearchVerifiedChannelsRead = {
  person_count: number
  persons_with_verified_email: number
  persons_with_verified_phone: number
  persons_with_verified_profile: number
  by_person_id: Record<string, GrowthProspectSearchVerifiedChannelPerson>
}

export type GrowthProspectSearchEngineIntelligence = {
  qa_marker: typeof GROWTH_PROSPECT_SEARCH_ENGINE_INTELLIGENCE_QA_MARKER
  schema_ready: boolean
  schema_health: GrowthSchemaHealthSummary | null
  canonical_company_id: string | null
  has_canonical_company: boolean
  company_intelligence: GrowthProspectSearchCompanyIntelligenceRead | null
  buying_committee: GrowthProspectSearchBuyingCommitteeRead | null
  verified_channels: GrowthProspectSearchVerifiedChannelsRead | null
  source_labels: string[]
}
