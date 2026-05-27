/** Prospect Search contact intelligence bridge types (Sprint 4C). Client-safe. */

export const GROWTH_PROSPECT_SEARCH_CONTACT_INTELLIGENCE_QA_MARKER =
  "growth-prospect-search-contact-intelligence-v1" as const

export type ProspectSearchContactEvidence = {
  claim: string
  evidence: string
  source: string
}

export type ProspectSearchContactOverlay = {
  id: string
  name: string
  title: string | null
  confidence: number
  source_evidence: ProspectSearchContactEvidence[]
  role_type: string
  recommended_priority: number
  linkedin_url?: string | null
  phone?: string | null
  email?: string | null
}

export type ProspectSearchCommitteeRoleMapping = {
  role: string
  role_type: string
  confidence: number
  recommended_order: number
  has_named_contact: boolean
  contact_name?: string | null
}

export type ProspectSearchFirstContactRecommendation = {
  contact_id: string | null
  role: string
  name: string | null
  confidence: number
  reasons: string[]
}

export type ProspectSearchContactConfidenceExplanation = {
  confidence: number
  evidence: string[]
  reasoning: string[]
}

export type GrowthProspectSearchContactIntelligence = {
  qa_marker: typeof GROWTH_PROSPECT_SEARCH_CONTACT_INTELLIGENCE_QA_MARKER
  schema_ready: boolean
  has_contacts: boolean
  contacts: ProspectSearchContactOverlay[]
  committee_roles: ProspectSearchCommitteeRoleMapping[]
  committee_completeness_pct: number | null
  first_contact: ProspectSearchFirstContactRecommendation | null
  confidence_explanation: ProspectSearchContactConfidenceExplanation | null
  outreach_recommendation: string | null
  source_labels: string[]
  empty_reason: string | null
}

export type ProspectSearchLeadEngineContactHandoffContext = {
  first_contact_role: string | null
  first_contact_name: string | null
  first_contact_confidence: number | null
  committee_completeness_pct: number | null
  contact_count: number
  summary: string | null
}
