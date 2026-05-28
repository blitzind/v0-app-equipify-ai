/** Prospect Search contact intelligence bridge types (Sprint 4C). Client-safe. */

import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"

export const GROWTH_PROSPECT_SEARCH_CONTACT_INTELLIGENCE_QA_MARKER =
  "growth-prospect-search-contact-intelligence-v1" as const

export type ProspectSearchContactEvidence = {
  claim: string
  evidence: string
  source: string
  page_url?: string | null
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
  source_page_url?: string | null
  last_checked_at?: string | null
  verification_status?: string | null
  outreach_ready?: boolean
  source_label?: string | null
  phone_on_dnc?: boolean | null
  email_suppressed?: boolean
  discovered_at?: string | null
  last_verified_at?: string | null
  source_last_seen_at?: string | null
  verification_expires_at?: string | null
  freshness_status?: string | null
  email_verification_depth?: string | null
  phone_verification_depth?: string | null
  source_page_type?: string | null
  email_classification?: string | null
  phone_classification?: string | null
  evidence_quality_score?: number | null
  evidence_quality_label?: string | null
  evidence_quality_reasons?: string[]
  extraction_risks?: string[]
  branch_name?: string | null
  branch_city?: string | null
  branch_state?: string | null
  branch_phone?: string | null
  location_confidence?: number | null
  linkedin_company_url?: string | null
  linkedin_reference_label?: string | null
  contact_identity_key?: string | null
  identity_confidence?: number | null
  merge_confidence?: number | null
  conflict_status?: import("@/lib/growth/prospect-search/prospect-search-contact-identity-types").ProspectSearchContactConflictStatus | null
  source_count?: number | null
  operator_confirmed?: boolean
  identity_resolution?: import("@/lib/growth/prospect-search/prospect-search-contact-identity-types").ProspectSearchContactIdentityResolution | null
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
  contact_coverage_score?: number | null
  contact_coverage_label?: string | null
  contact_confidence_score?: number | null
  primary_contact_id?: string | null
  recommended_contact_id?: string | null
  schema_health?: GrowthSchemaHealthSummary | null
  company_contact_coverage?: import("@/lib/growth/prospect-search/prospect-search-company-contact-coverage-intelligence").ProspectSearchCompanyContactCoverageIntelligence | null
  account_contact_strategy?: import("@/lib/growth/prospect-search/prospect-search-account-contact-strategy").ProspectSearchAccountContactStrategy | null
  org_intelligence?: import("@/lib/growth/prospect-search/prospect-search-org-intelligence").ProspectSearchOrgIntelligence | null
  outreach_sequence?: import("@/lib/growth/prospect-search/prospect-search-contact-influence").ProspectSearchAccountOutreachSequence | null
  contact_influences?: import("@/lib/growth/prospect-search/prospect-search-contact-influence").ProspectSearchContactInfluenceResult[]
  relationship_memory?: import("@/lib/growth/prospect-search/prospect-search-relationship-memory").ProspectSearchRelationshipMemorySnapshot | null
  account_timeline?: import("@/lib/growth/prospect-search/prospect-search-account-timeline").ProspectSearchAccountTimeline | null
  account_progression?: import("@/lib/growth/prospect-search/prospect-search-account-progression").ProspectSearchAccountProgression | null
  lead_relationship_hydration?: import("@/lib/growth/prospect-search/prospect-search-relationship-memory").ProspectSearchLeadRelationshipHydration | null
  opportunity_emergence?: import("@/lib/growth/prospect-search/prospect-search-opportunity-emergence").ProspectSearchOpportunityEmergence | null
  sequence_readiness?: import("@/lib/growth/prospect-search/prospect-search-sequence-readiness").ProspectSearchSequenceReadiness | null
  operating_alerts?: import("@/lib/growth/prospect-search/prospect-search-revenue-operating-alerts").ProspectSearchOperatingAlertsSnapshot | null
  operator_assist?: import("@/lib/growth/prospect-search/prospect-search-operator-assist-intelligence").ProspectSearchOperatorAssistBundle | null
  command_overlays?: import("@/lib/growth/prospect-search/prospect-search-command-overlays").ProspectSearchCommandOverlaysSnapshot | null
  website_extraction_diagnostics?: import("@/lib/growth/contact-discovery/website-extraction-acquisition-types").WebsiteExtractionDiagnosticsSnapshot | null
  contact_identities?: import("@/lib/growth/prospect-search/prospect-search-contact-identity-types").ProspectSearchContactIdentityResolution[]
}

export type ProspectSearchLeadEngineContactHandoffContext = {
  first_contact_role: string | null
  first_contact_name: string | null
  first_contact_confidence: number | null
  committee_completeness_pct: number | null
  contact_count: number
  summary: string | null
  email_available: boolean
  phone_available: boolean
  contact_sources: string[]
  compliance_status: "ready" | "suppressed" | "review_required"
  outreach_ready: boolean
  contact_research_required_message: string | null
  freshness_status?: string | null
  confidence_reason?: string | null
  account_strategy?: {
    readiness_tier: string
    recommended_channel: string
    strategy_summary: string | null
    primary_contact_id: string | null
    primary_contact_name: string | null
    secondary_contact_ids: string[]
    blocked_contact_ids: string[]
    blocked_reasons: string[]
    missing_personas: string[]
    safest_next_action: string
    contact_research_next_step: string | null
  } | null
}
