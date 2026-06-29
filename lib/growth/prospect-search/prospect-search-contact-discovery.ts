/** Prospect Search contact discovery UX — coverage, people rows, provider honesty. Client-safe. */

import { isNativeRevenueDecisionEngineEnabledClient } from "@/lib/growth/contact-verification/native-revenue-decision-feature"
import {
  resolveContactOutreachEligibilityBundle,
  type ProspectSearchContactEligibilityState,
} from "@/lib/growth/prospect-search/prospect-search-contact-eligibility"
import { buildProspectSearchContactConfidenceReasoning } from "@/lib/growth/prospect-search/prospect-search-contact-confidence-reasoning"
import {
  resolveProspectSearchContactFreshness,
  resolveProspectSearchStaleWarning,
  GROWTH_CONTACT_FRESHNESS_QA_MARKER,
  type ProspectSearchContactFreshnessStatus,
} from "@/lib/growth/prospect-search/prospect-search-contact-freshness"
import {
  classifyProspectSearchEmailVerificationDepth,
  classifyProspectSearchPhoneVerificationDepth,
  emailDepthImpliesVerified,
  phoneDepthImpliesCallable,
  type ProspectSearchEmailVerificationDepth,
  type ProspectSearchPhoneVerificationDepth,
} from "@/lib/growth/prospect-search/prospect-search-contact-verification-depth"
import {
  applyProspectSearchContactRankingToPeopleRows,
  type ProspectSearchContactPriorityTier,
} from "@/lib/growth/prospect-search/prospect-search-contact-ranking"
import {
  buildProspectSearchCompanyContactCoverageIntelligence,
  type ProspectSearchCompanyContactCoverageIntelligence,
} from "@/lib/growth/prospect-search/prospect-search-company-contact-coverage-intelligence"
import {
  buildProspectSearchAccountContactStrategy,
  GROWTH_ACCOUNT_CONTACT_STRATEGY_QA_MARKER,
  GROWTH_MULTI_CONTACT_ORCHESTRATION_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-account-contact-strategy"
import {
  applyInfluenceSequencingToContacts,
  buildProspectSearchAccountOutreachSequence,
  computeContactInfluenceScore,
  GROWTH_CONTACT_INFLUENCE_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-contact-influence"
import {
  buildProspectSearchOrgIntelligence,
  GROWTH_ORG_INTELLIGENCE_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-org-intelligence"
import {
  buildProspectSearchRelationshipIntelligence,
  type ProspectSearchRelationshipIntelligenceBundle,
} from "@/lib/growth/prospect-search/prospect-search-relationship-intelligence"
import { resolveRelationshipQueueBoost } from "@/lib/growth/prospect-search/prospect-search-relationship-memory"
import { resolveProgressionQueueBoost } from "@/lib/growth/prospect-search/prospect-search-account-progression"
import {
  buildProspectSearchOperationalIntelligence,
  applyOperationalIntelligenceQueueBoost,
} from "@/lib/growth/prospect-search/prospect-search-operational-intelligence"
import {
  buildProspectSearchOperatorAssistIntelligence,
  applyOperatorAssistIntelligenceQueueBoost,
} from "@/lib/growth/prospect-search/prospect-search-operator-assist-intelligence"
import type { ProspectSearchTerritoryOpportunityScore } from "@/lib/growth/prospect-search/prospect-search-territory-prioritization"
import { resolveCompanyTerritoryOpportunityBoost } from "@/lib/growth/prospect-search/prospect-search-territory-prioritization"
import {
  resolveProspectSearchRevenuePersona,
  type ProspectSearchRevenuePersonaIntelligence,
} from "@/lib/growth/prospect-search/prospect-search-revenue-persona-intelligence"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"
import {
  formatProspectSearchContactSourceLabel,
  computeProspectSearchContactOutreachReadiness,
} from "@/lib/growth/prospect-search/prospect-search-contact-readiness"
import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchFilters,
  GrowthProspectSearchPersonResult,
} from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_PROSPECT_CONTACT_DISCOVERY_QA_MARKER =
  "growth-prospect-contact-discovery-v1" as const

export { GROWTH_PEOPLE_HYDRATION_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-contact-readiness"
export { GROWTH_WEBSITE_CONTACT_PROVIDER_QA_MARKER } from "@/lib/growth/contact-discovery/website-extract-mapper"
export { GROWTH_PEOPLE_WORKFLOWS_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-people-selection"
export { GROWTH_CONTACT_ELIGIBILITY_ENGINE_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-contact-eligibility"
export { GROWTH_CONTACT_FRESHNESS_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-contact-freshness"
export { GROWTH_CONTACT_VERIFICATION_DEPTH_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-contact-verification-depth"
export { GROWTH_CONTACT_RANKING_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-contact-ranking"
export { GROWTH_REVENUE_PERSONA_INTELLIGENCE_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-revenue-persona-intelligence"
export {
  GROWTH_ACCOUNT_CONTACT_STRATEGY_QA_MARKER,
  GROWTH_MULTI_CONTACT_ORCHESTRATION_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-account-contact-strategy"
export { GROWTH_ORG_INTELLIGENCE_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-org-intelligence"
export { GROWTH_CONTACT_INFLUENCE_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-contact-influence"
export { GROWTH_TERRITORY_PRIORITIZATION_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-territory-prioritization"
export { GROWTH_RELATIONSHIP_MEMORY_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-relationship-memory"
export { GROWTH_ACCOUNT_TIMELINE_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-account-timeline"
export { GROWTH_ACCOUNT_PROGRESSION_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-account-progression"
export { GROWTH_OPPORTUNITY_EMERGENCE_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-opportunity-emergence"
export { GROWTH_SEQUENCE_READINESS_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-sequence-readiness"
export { GROWTH_REVENUE_OPERATING_ALERTS_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-revenue-operating-alerts"
export {
  GROWTH_DEEP_CONTACT_ACQUISITION_QA_MARKER,
  GROWTH_PUBLIC_PROFILE_REFERENCE_QA_MARKER,
  GROWTH_WEBSITE_EXTRACTION_QUALITY_QA_MARKER,
} from "@/lib/growth/contact-discovery/website-acquisition-metadata-bridge"
export {
  GROWTH_CONTACT_IDENTITY_RESOLUTION_QA_MARKER,
  GROWTH_EVIDENCE_FUSION_QA_MARKER,
  GROWTH_CONTACT_CONFLICT_REVIEW_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-contact-identity-fusion"
export {
  enrichPeopleRowsWithRelationshipMemory,
} from "@/lib/growth/prospect-search/prospect-search-relationship-intelligence"
export { GROWTH_CONTACT_NATIVE_SEARCH_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-contact-native-index"

export type ProspectSearchContactCoverageStatus =
  | "no_contacts_found"
  | "website_extraction_pending"
  | "contact_research_needed"
  | "contacts_found"
  | "email_available"
  | "phone_available"
  | "needs_verification"
  | "blocked_suppressed"

export type ProspectSearchContactProviderState =
  | "connected"
  | "internal_sources"
  | "website_crawl"
  | "no_provider_connected"

export type GrowthProspectSearchPeopleResultRow = GrowthProspectSearchPersonResult & {
  company: GrowthProspectSearchCompanyResult
  contact_id: string
  email_reason: string | null
  phone_reason: string | null
  source_label: string | null
  source_page_url: string | null
  confidence: number
  location: string | null
  compliance_status: "ready" | "suppressed" | "review_required"
  last_checked_at: string | null
  outreach_ready: boolean
  email_available: boolean
  phone_available: boolean
  call_ready: boolean
  sms_ready: boolean
  readiness_label: string
  email_eligibility: ProspectSearchContactEligibilityState
  call_eligibility: ProspectSearchContactEligibilityState
  sms_eligibility: ProspectSearchContactEligibilityState
  call_block_reason: string | null
  sms_block_reason: string | null
  phone_on_dnc: boolean | null
  timeline_events: ProspectSearchPeopleTimelineEvent[]
  discovered_at: string | null
  last_verified_at: string | null
  source_last_seen_at: string | null
  verification_expires_at: string | null
  freshness_status: ProspectSearchContactFreshnessStatus
  email_verification_depth: ProspectSearchEmailVerificationDepth
  phone_verification_depth: ProspectSearchPhoneVerificationDepth
  confidence_label: string
  confidence_reason: string
  confidence_top_reasons: string[]
  confidence_risk_notes: string[]
  stale_warning: string | null
  persona: ProspectSearchRevenuePersonaIntelligence
  persona_type: ProspectSearchRevenuePersonaIntelligence["persona_type"]
  persona_label: string
  persona_icp_relevance: number
  persona_buying_influence: number
  persona_outreach_suitability: number
  persona_evidence: string[]
  outreach_rank_score: number
  priority_tier: ProspectSearchContactPriorityTier
  ranking_reasons: string[]
  ranking_risks: string[]
  recommended_next_action: string
  is_recommended_contact: boolean
  is_secondary_contact: boolean
  influence_score: number
  influence_tier: string
  influence_reasons: string[]
  likely_department: string
  sequencing_role: string | null
  sequencing_note: string | null
  outreach_sequence_position: number | null
  relationship_status: string
  relationship_momentum: string
  relationship_strength_score: number
  relationship_last_interaction_at: string | null
  relationship_summary: string | null
  source_page_type: string | null
  email_classification: string | null
  phone_classification: string | null
  evidence_quality_score: number | null
  evidence_quality_label: string | null
  evidence_quality_reasons: string[]
  extraction_risks: string[]
  branch_name: string | null
  branch_city: string | null
  branch_state: string | null
  branch_phone: string | null
  location_confidence: number | null
  linkedin_company_url: string | null
  linkedin_reference_label: string | null
  contact_identity_key: string | null
  identity_confidence: number | null
  merge_confidence: number | null
  conflict_status: string | null
  source_count: number | null
  operator_confirmed: boolean
  identity_resolution: import("@/lib/growth/prospect-search/prospect-search-contact-identity-types").ProspectSearchContactIdentityResolution | null
  contact_native_rank_score?: number | null
  contact_native_rank_reasons?: string[]
  reachable_human_score?: number | null
}

export type ProspectSearchResultMode = "people" | "companies" | "territory" | "queue"

export const PROSPECT_SEARCH_RESULT_MODES: ProspectSearchResultMode[] = [
  "people",
  "companies",
  "territory",
  "queue",
]

export const GROWTH_BULK_CONTACT_OPERATIONS_QA_MARKER = "growth-bulk-contact-operations-v1" as const
export const GROWTH_CONTACT_DRAWER_QA_MARKER = "growth-contact-drawer-v1" as const
export const GROWTH_CONTACT_NATIVE_PAGINATION_QA_MARKER = "growth-contact-native-pagination-v1" as const
export const GROWTH_PROSPEO_STYLE_RESULTS_QA_MARKER = "growth-prospeo-style-results-v1" as const
export const GROWTH_PROGRESSIVE_COMPANY_OVERLAY_QA_MARKER = "growth-progressive-company-overlay-v1" as const
export const GROWTH_PEOPLE_FIRST_GRID_QA_MARKER = "growth-people-first-grid-v1" as const

export type ProspectSearchPeopleTimelineEvent = {
  id: string
  kind:
    | "discovered"
    | "verified"
    | "refreshed"
    | "routed_queue"
    | "added_pipeline"
    | "suppressed"
    | "freshness"
    | "verification"
  label: string
  detail: string
  occurred_at: string | null
}

export function hasProspectSearchDecisionMakerFilters(
  filters: GrowthProspectSearchFilters,
): boolean {
  return Boolean(
    filters.title_contains?.trim() ||
      filters.decision_maker_role?.trim() ||
      (filters.title_hints?.length ?? 0) > 0,
  )
}

export function resolveProspectSearchContactProviderState(
  company: GrowthProspectSearchCompanyResult,
): ProspectSearchContactProviderState {
  const labels = company.contact_intelligence?.source_labels ?? []
  if (
    labels.some(
      (label) =>
        label.includes("website_public_extract") || label.includes("growth.company_contacts"),
    )
  ) {
    return "website_crawl"
  }
  if (labels.some((label) => label.includes("people_data_labs") || label.includes("pdl"))) {
    return "connected"
  }
  if (labels.some((label) => label.includes("contact_discovery"))) return "connected"
  if (labels.some((label) => label.includes("lead_decision_makers") || label.includes("lead_engine"))) {
    return "internal_sources"
  }
  if (company.source_type === "external_discovered") return "no_provider_connected"
  if (company.growth_lead_id) return "internal_sources"
  return "no_provider_connected"
}

export function resolveProspectSearchContactCoverageStatus(
  company: GrowthProspectSearchCompanyResult,
): ProspectSearchContactCoverageStatus {
  if (company.is_suppressed) return "blocked_suppressed"

  const labels = company.contact_intelligence?.source_labels ?? []
  const intelligence = company.contact_intelligence
  const contacts = intelligence?.contacts ?? []
  const hasNamedContacts = contacts.some((contact) => contact.name.trim().length > 0)
  const hasEmail = contacts.some((contact) => contact.email?.trim())
  const hasPhone = contacts.some((contact) => contact.phone?.trim())
  const providerState = resolveProspectSearchContactProviderState(company)

  if (!hasNamedContacts) {
    const extracted = labels.some(
      (label) =>
        label.includes("website_public_extract") ||
        label.includes("growth.company_contacts") ||
        label.includes("contact_discovery"),
    )
    if (company.website?.trim() && !extracted) {
      return "website_extraction_pending"
    }
    if (providerState === "no_provider_connected" && company.source_type === "external_discovered") {
      return "contact_research_needed"
    }
    return "no_contacts_found"
  }

  if (hasEmail && hasPhone) return "phone_available"
  if (hasEmail) return "email_available"
  if (hasPhone) return "phone_available"

  const needsVerification = contacts.some(
    (contact) => !contact.email?.trim() && !contact.phone?.trim() && contact.name.trim().length > 0,
  )
  if (needsVerification) return "needs_verification"
  return "contacts_found"
}

export function formatProspectSearchContactCoverageLabel(
  status: ProspectSearchContactCoverageStatus,
): string {
  switch (status) {
    case "no_contacts_found":
      return "No contacts found"
    case "website_extraction_pending":
      return "Website extraction pending"
    case "contact_research_needed":
      return "Contact research needed"
    case "contacts_found":
      return "Contacts found"
    case "email_available":
      return "Email available"
    case "phone_available":
      return "Phone available"
    case "needs_verification":
      return "Needs verification"
    case "blocked_suppressed":
      return "Blocked / suppressed"
    default:
      return "Contact research needed"
  }
}

export function resolveProspectSearchContactFieldReason(input: {
  value: string | null | undefined
  company: GrowthProspectSearchCompanyResult
  channel: "email" | "phone"
}): string {
  const { company, channel, value } = input
  if (value?.trim()) return channel === "email" ? "Verified email on file" : "Phone on file"

  if (company.is_suppressed) return "Suppressed, do not contact"

  const providerState = resolveProspectSearchContactProviderState(company)
  if (providerState === "website_crawl" || company.website?.trim()) {
    return channel === "email"
      ? "No verified email on public website yet — run Find contacts"
      : "No phone on public website yet — run Find contacts"
  }
  if (providerState === "no_provider_connected" && company.source_type === "external_discovered") {
    return "Run Find contacts to extract public website contacts"
  }

  const intelligence = company.contact_intelligence
  if (!intelligence?.has_contacts) {
    return channel === "email"
      ? "No verified contacts yet — run Find contacts"
      : "Phone unavailable from current sources"
  }

  return channel === "email"
    ? "Email not found from current sources"
    : "Phone unavailable from current sources"
}

function buildPeopleContactProfile(input: {
  contact: GrowthProspectSearchContactIntelligence["contacts"][number]
  company: GrowthProspectSearchCompanyResult
  source_label: string | null
  source_page_url: string | null
  phone_on_dnc: boolean | null
  email_suppressed: boolean
}) {
  const { contact, company, source_label, source_page_url, phone_on_dnc, email_suppressed } = input
  const sourceEvidence = contact.source_evidence ?? []
  const meta = contact as {
    discovered_at?: string | null
    last_verified_at?: string | null
    source_last_seen_at?: string | null
    email_status?: string | null
    phone_status?: string | null
  }

  const freshness = resolveProspectSearchContactFreshness({
    discovered_at: meta.discovered_at ?? contact.last_checked_at ?? null,
    last_checked_at: contact.last_checked_at ?? null,
    last_verified_at: meta.last_verified_at ?? null,
    source_last_seen_at: meta.source_last_seen_at ?? contact.source_page_url ?? null,
  })

  const email_verification_depth = classifyProspectSearchEmailVerificationDepth({
    email: contact.email,
    source_label,
    source_page_url,
    source_evidence: sourceEvidence,
    email_status: meta.email_status ?? null,
  })
  const phone_verification_depth = classifyProspectSearchPhoneVerificationDepth({
    phone: contact.phone,
    source_label,
    source_page_url,
    source_evidence: sourceEvidence,
    phone_on_dnc,
    phone_status: meta.phone_status ?? null,
  })

  const verification_status = resolveContactVerificationStatus(contact, company, {
    email_verification_depth,
    phone_verification_depth,
  })

  const confidenceReasoning = buildProspectSearchContactConfidenceReasoning({
    confidence: contact.confidence,
    email: contact.email,
    phone: contact.phone,
    title: contact.title,
    source_label,
    source_page_url,
    source_evidence_count: sourceEvidence.length,
    email_verification_depth,
    phone_verification_depth,
    freshness_status: freshness.freshness_status,
    company_match_confidence: company.company_match_confidence,
    company_suppressed: company.is_suppressed,
    phone_on_dnc,
  })

  const eligibility = resolveContactOutreachEligibilityBundle({
    email: contact.email,
    phone: contact.phone,
    verification_status,
    confidence: confidenceReasoning.confidence_score,
    company_suppressed: company.is_suppressed,
    contact_suppressed: company.is_suppressed,
    email_suppressed,
    phone_on_dnc,
    last_checked_at: freshness.last_checked_at,
    source_label,
    source_page_url,
    freshness_status: freshness.freshness_status,
    email_verification_depth,
    phone_verification_depth,
  })

  const readiness = computeProspectSearchContactOutreachReadiness({
    email: contact.email,
    phone: contact.phone,
    verification_status,
    confidence: confidenceReasoning.confidence_score,
    suppressed: company.is_suppressed,
  })

  const stale_warning = resolveProspectSearchStaleWarning({
    freshness_status: freshness.freshness_status,
    last_checked_at: freshness.last_checked_at,
    email: contact.email,
    phone: contact.phone,
    email_verification_depth,
    phone_verification_depth,
    email_eligibility: eligibility.email.state,
    call_eligibility: eligibility.call.state,
  })

  const persona = resolveProspectSearchRevenuePersona({
    title: contact.title,
    role_type: contact.role_type,
    source_label,
    source_page_url,
    source_evidence: sourceEvidence,
    industry: company.industry,
  })

  const email_reason = contact.email?.trim()
    ? formatEmailFieldReason(email_verification_depth)
    : resolveProspectSearchContactFieldReason({
        value: contact.email,
        company,
        channel: "email",
      })
  const phone_reason = contact.phone?.trim()
    ? formatPhoneFieldReason(phone_verification_depth, phone_on_dnc)
    : resolveProspectSearchContactFieldReason({
        value: contact.phone,
        company,
        channel: "phone",
      })

  return {
    freshness,
    email_verification_depth,
    phone_verification_depth,
    verification_status,
    confidenceReasoning,
    eligibility,
    readiness,
    stale_warning,
    email_reason,
    phone_reason,
    persona,
  }
}

function formatEmailFieldReason(depth: ProspectSearchEmailVerificationDepth): string {
  switch (depth) {
    case "published_on_website":
      return "Published on company website"
    case "role_email":
      return "Role email discovered on website"
    case "personal_email":
      return "Personal-format email discovered"
    case "verification_needed":
      return "Email found but not verified"
    case "invalid_format":
      return "Invalid email format"
    case "disposable_domain":
      return "Disposable email domain detected"
    default:
      return "Email on file — verification pending"
  }
}

function formatPhoneFieldReason(
  depth: ProspectSearchPhoneVerificationDepth,
  phone_on_dnc: boolean | null,
): string {
  if (phone_on_dnc === true) return "DNC blocked — do not call"
  switch (depth) {
    case "published_on_website":
      return "Published on company website"
    case "mobile_possible":
      return "Mobile-capable phone on file"
    case "office_line":
      return "Office line on file"
    case "toll_free":
      return "Toll-free number on file"
    case "dispatch_line":
      return "Dispatch line on file"
    case "verification_needed":
      return "Phone found, call readiness pending"
    case "invalid_format":
      return "Invalid phone format"
    default:
      return "Phone on file"
  }
}

export function enrichProspectSearchPeopleRowsWithRanking(
  rows: GrowthProspectSearchPeopleResultRow[],
): GrowthProspectSearchPeopleResultRow[] {
  if (rows.length === 0) return rows

  const rankingInputs = rows.map((row) => {
    const memory = row.company.contact_intelligence?.relationship_memory
    return {
      ...row,
      contact_id: row.contact_id,
      company_id: row.company_id,
      confidence_score: row.confidence,
      persona: row.persona,
      in_lead_inbox: row.company.in_lead_inbox,
      existing_customer: row.company.existing_customer,
      existing_prospect: row.company.existing_prospect,
      lead_engine_score: row.company.lead_engine_score ?? row.company.lead_score,
      company_suppressed: row.company.is_suppressed,
      relationship_strength_score: memory?.relationship_strength_score ?? null,
      relationship_status: memory?.relationship_status ?? null,
      relationship_momentum: memory?.momentum_direction ?? null,
      evidence_quality_score: row.evidence_quality_score,
      evidence_quality_label: row.evidence_quality_label,
      email_classification: row.email_classification,
      phone_classification: row.phone_classification,
      linkedin_reference_label: row.linkedin_reference_label,
      branch_name: row.branch_name,
      branch_city: row.branch_city,
      branch_state: row.branch_state,
      identity_confidence: row.identity_confidence,
      merge_confidence: row.merge_confidence,
      conflict_status: row.conflict_status,
      operator_confirmed: row.operator_confirmed,
      source_count: row.source_count,
    }
  })

  const ranked = applyProspectSearchContactRankingToPeopleRows(rankingInputs)

  return ranked.map((row) => ({
    ...row,
    rank_score: row.outreach_rank_score,
    outreach_rank_score: row.outreach_rank_score,
    priority_tier: row.priority_tier,
    ranking_reasons: row.ranking_reasons,
    ranking_risks: row.ranking_risks,
    recommended_next_action: row.recommended_next_action,
    is_recommended_contact: row.is_recommended_contact,
    is_secondary_contact: row.is_secondary_contact,
    persona_type: row.persona.persona_type,
    persona_label: row.persona.persona_label,
    persona_icp_relevance: row.persona.icp_relevance,
    persona_buying_influence: row.persona.buying_influence,
    persona_outreach_suitability: row.persona.outreach_suitability,
    persona_evidence: row.persona.evidence,
  }))
}

export function enrichPeopleRowsWithContactInfluence(
  peopleRows: GrowthProspectSearchPeopleResultRow[],
  companies: GrowthProspectSearchCompanyResult[],
): GrowthProspectSearchPeopleResultRow[] {
  const influenceByCompany = new Map<string, Map<string, import("@/lib/growth/prospect-search/prospect-search-contact-influence").ProspectSearchContactInfluenceResult>>()
  for (const company of companies) {
    const map = new Map<string, import("@/lib/growth/prospect-search/prospect-search-contact-influence").ProspectSearchContactInfluenceResult>()
    for (const influence of company.contact_intelligence?.contact_influences ?? []) {
      map.set(influence.contact_id, influence)
    }
    if (map.size > 0) influenceByCompany.set(company.id, map)
  }

  return peopleRows.map((row) => {
    const influence = influenceByCompany.get(row.company_id)?.get(row.contact_id)
    if (!influence) {
      return {
        ...row,
        influence_score: 0,
        influence_tier: "unknown",
        influence_reasons: [],
        likely_department: "general",
        sequencing_role: null,
        sequencing_note: null,
        outreach_sequence_position: null,
      }
    }
    return {
      ...row,
      influence_score: influence.influence_score,
      influence_tier: influence.influence_tier,
      influence_reasons: influence.influence_reasons,
      likely_department: influence.likely_department,
      sequencing_role: influence.sequencing_role,
      sequencing_note: influence.sequencing_note,
      outreach_sequence_position: influence.outreach_sequence_position,
    }
  })
}

export function attachProspectSearchCompanyCoverageIntelligence(
  companies: GrowthProspectSearchCompanyResult[],
  peopleRows: GrowthProspectSearchPeopleResultRow[],
  options?: {
    territoryPrioritization?: ProspectSearchTerritoryOpportunityScore[]
    nativeDecisionByCompanyId?: Map<
      string,
      import("@/lib/growth/contact-verification/native-revenue-decision-adapter").NativeRevenueDecisionAuthoritativeBundle
    >
  },
): GrowthProspectSearchCompanyResult[] {
  const rowsByCompany = new Map<string, GrowthProspectSearchPeopleResultRow[]>()
  for (const row of peopleRows) {
    const list = rowsByCompany.get(row.company_id) ?? []
    list.push(row)
    rowsByCompany.set(row.company_id, list)
  }

  return companies.map((company) => {
    const contacts = rowsByCompany.get(company.id) ?? []
    if (contacts.length === 0) return company

    const coverage = buildProspectSearchCompanyContactCoverageIntelligence({
      company_name: company.company_name,
      company_suppressed: company.is_suppressed,
      contacts: contacts.map((row) => ({
        contact_id: row.contact_id,
        full_name: row.full_name,
        persona_type: row.persona_type,
        outreach_rank_score: row.outreach_rank_score,
        priority_tier: row.priority_tier,
        email_available: row.email_available,
        phone_available: row.phone_available,
        call_ready: row.call_ready,
        email_eligibility: row.email_eligibility,
        is_recommended_contact: row.is_recommended_contact,
        verification_status: row.verification_status,
      })),
    })

    const strategyContacts = contacts.map((row) => ({
      contact_id: row.contact_id,
      full_name: row.full_name,
      title: row.title,
      persona_label: row.persona_label,
      persona_type: row.persona_type,
      outreach_rank_score: row.outreach_rank_score,
      priority_tier: row.priority_tier,
      freshness_status: row.freshness_status,
      email_available: row.email_available,
      phone_available: row.phone_available,
      call_ready: row.call_ready,
      sms_ready: row.sms_ready,
      email_eligibility: row.email_eligibility,
      call_eligibility: row.call_eligibility,
      sms_eligibility: row.sms_eligibility,
      call_block_reason: row.call_block_reason,
      sms_block_reason: row.sms_block_reason,
      phone_on_dnc: row.phone_on_dnc,
      email_verification_depth: row.email_verification_depth,
      phone_verification_depth: row.phone_verification_depth,
      is_recommended_contact: row.is_recommended_contact,
      is_secondary_contact: row.is_secondary_contact,
      ranking_reasons: row.ranking_reasons,
      ranking_risks: row.ranking_risks,
    }))

    const orgContacts = contacts.map((row) => ({
      contact_id: row.contact_id,
      full_name: row.full_name,
      title: row.title,
      persona_type: row.persona_type,
      persona_label: row.persona_label,
      source_page_url: row.source_page_url,
      source_label: row.source_label,
      persona_evidence: row.persona_evidence,
    }))

    const org_intelligence = buildProspectSearchOrgIntelligence({
      company_name: company.company_name,
      contacts: orgContacts,
    })

    const relationshipBundle: ProspectSearchRelationshipIntelligenceBundle =
      buildProspectSearchRelationshipIntelligence({
        company,
        peopleRows: contacts,
        leadHydration: company.contact_intelligence?.lead_relationship_hydration ?? null,
      })

    const influenceByContact = new Map(
      contacts.map((row) => {
        const memory = relationshipBundle.relationship_memory
        const influence = computeContactInfluenceScore({
          contact: {
            contact_id: row.contact_id,
            full_name: row.full_name,
            title: row.title,
            persona_type: row.persona_type,
            persona_label: row.persona_label,
            persona_icp_relevance: row.persona_icp_relevance,
            persona_buying_influence: row.persona_buying_influence,
            persona_outreach_suitability: row.persona_outreach_suitability,
            operational_authority: row.persona.outreach_suitability,
            outreach_rank_score: row.outreach_rank_score,
            priority_tier: row.priority_tier,
            source_page_url: row.source_page_url,
            source_label: row.source_label,
            is_recommended_contact: row.is_recommended_contact,
            in_lead_inbox: company.in_lead_inbox,
            existing_prospect: company.existing_prospect,
            relationship_strength_score: memory?.relationship_strength_score,
            relationship_status: memory?.relationship_status,
          },
          relationship_graph: org_intelligence.relationship_graph,
        })
        return [row.contact_id, influence] as const
      }),
    )

    const sequencedInfluence = applyInfluenceSequencingToContacts([...influenceByContact.values()])
    for (const item of sequencedInfluence) {
      influenceByContact.set(item.contact_id, item)
    }

    const outreach_sequence = buildProspectSearchAccountOutreachSequence({
      contacts: contacts.map((row) => ({
        contact_id: row.contact_id,
        full_name: row.full_name,
        title: row.title,
        persona_type: row.persona_type,
        persona_label: row.persona_label,
        persona_icp_relevance: row.persona_icp_relevance,
        persona_buying_influence: row.persona_buying_influence,
        persona_outreach_suitability: row.persona_outreach_suitability,
        outreach_rank_score: row.outreach_rank_score,
        priority_tier: row.priority_tier,
        is_recommended_contact: row.is_recommended_contact,
        influence: influenceByContact.get(row.contact_id)!,
      })),
      blocked_contact_ids: contacts
        .filter((row) => row.priority_tier === "blocked")
        .map((row) => row.contact_id),
    })

    const accountStrategy = buildProspectSearchAccountContactStrategy({
      company_id: company.id,
      company_name: company.company_name,
      company_suppressed: company.is_suppressed,
      company_match_confidence: company.company_match_confidence,
      lead_engine_score: company.lead_engine_score ?? company.lead_score,
      in_lead_inbox: company.in_lead_inbox,
      existing_customer: company.existing_customer,
      contacts: strategyContacts,
      coverage,
    })

    const territoryBoost = resolveCompanyTerritoryOpportunityBoost(
      company,
      options?.territoryPrioritization ?? [],
    )
    const territoryScore =
      options?.territoryPrioritization?.find(
        (t) => resolveCompanyTerritoryOpportunityBoost(company, [t]) > 0,
      )?.territory_score ?? null

    const nativeDecisionBundle = options?.nativeDecisionByCompanyId?.get(company.id) ?? null

    const operationalBundle = buildProspectSearchOperationalIntelligence({
      company,
      peopleRows: contacts,
      coverage,
      accountStrategy,
      relationshipBundle,
      territory_score: territoryScore,
      nativeDecisionBundle,
    })

    let finalStrategy = applyOperationalIntelligenceQueueBoost(
      accountStrategy,
      operationalBundle,
    )

    const operatorAssistBundle = buildProspectSearchOperatorAssistIntelligence({
      company,
      peopleRows: contacts,
      coverage,
      accountStrategy: finalStrategy,
      relationshipBundle,
      operationalBundle,
      orgIntelligence: org_intelligence,
      contactInfluences: [...influenceByContact.values()],
      territory_score: territoryScore,
      in_active_queue: company.in_lead_inbox ?? false,
      nativeDecisionBundle,
    })

    finalStrategy = applyOperatorAssistIntelligenceQueueBoost(finalStrategy, operatorAssistBundle)

    if (territoryBoost > 0) {
      finalStrategy = {
        ...finalStrategy,
        queue_priority_score: Math.round(
          Math.min(100, finalStrategy.queue_priority_score + territoryBoost),
        ),
        strategy_reasons: [
          ...finalStrategy.strategy_reasons,
          `Territory opportunity boost +${Math.round(territoryBoost)}`,
        ],
      }
    }

    const topInfluence = [...influenceByContact.values()].sort(
      (a, b) => b.influence_score - a.influence_score,
    )[0]
    if (
      topInfluence &&
      topInfluence.influence_score >= 0.7 &&
      finalStrategy.primary_contact?.contact_id !== topInfluence.contact_id
    ) {
      finalStrategy = {
        ...finalStrategy,
        strategy_reasons: [
          ...finalStrategy.strategy_reasons,
          `Highest influence: ${topInfluence.influence_tier.replace(/_/g, " ")} contact in org graph`,
        ],
      }
    }
    if (outreach_sequence.sequence_summary) {
      finalStrategy = {
        ...finalStrategy,
        strategy_summary: outreach_sequence.sequence_summary ?? finalStrategy.strategy_summary,
      }
    }

    const relBoost = resolveRelationshipQueueBoost(relationshipBundle.relationship_memory)
    const progBoost = resolveProgressionQueueBoost(relationshipBundle.account_progression)
    const relationshipBoost = relBoost + progBoost
    if (relationshipBoost !== 0) {
      finalStrategy = {
        ...finalStrategy,
        queue_priority_score: Math.round(
          Math.min(100, Math.max(0, finalStrategy.queue_priority_score + relationshipBoost)),
        ),
        strategy_reasons: [
          ...finalStrategy.strategy_reasons,
          ...(relBoost !== 0
            ? [`Relationship memory boost ${relBoost > 0 ? "+" : ""}${relBoost}`]
            : []),
          ...(progBoost !== 0
            ? [`Account progression boost ${progBoost > 0 ? "+" : ""}${progBoost}`]
            : []),
        ],
        queue_prioritization_reason:
          relationshipBundle.account_progression.next_best_action ??
          finalStrategy.queue_prioritization_reason,
      }
    }

    const intelligence = company.contact_intelligence
    if (!intelligence) return company

    const preserveNativeFromServer =
      isNativeRevenueDecisionEngineEnabledClient() &&
      intelligence.native_revenue_decision != null &&
      nativeDecisionBundle == null

    const authoritativeSequenceReadiness = preserveNativeFromServer && intelligence.sequence_readiness
      ? intelligence.sequence_readiness
      : operationalBundle.sequence_readiness
    const authoritativeOperatorAssist = preserveNativeFromServer && intelligence.operator_assist
      ? intelligence.operator_assist
      : operatorAssistBundle
    const authoritativeOutreachRecommendation = preserveNativeFromServer &&
      intelligence.outreach_recommendation
      ? intelligence.outreach_recommendation
      : operatorAssistBundle.operator_recommendations.top_recommendation
          ?.recommended_operator_action ??
        operationalBundle.opportunity_emergence.recommended_next_action ??
        finalStrategy.strategy_summary ??
        coverage.ranking_summary ??
        intelligence.outreach_recommendation ??
        coverage.coverage_label

    return {
      ...company,
      contact_intelligence: {
        ...intelligence,
        company_contact_coverage: coverage,
        account_contact_strategy: finalStrategy,
        org_intelligence,
        outreach_sequence,
        contact_influences: [...influenceByContact.values()],
        relationship_memory: relationshipBundle.relationship_memory,
        account_timeline: relationshipBundle.account_timeline,
        account_progression: relationshipBundle.account_progression,
        opportunity_emergence: operationalBundle.opportunity_emergence,
        sequence_readiness: authoritativeSequenceReadiness,
        operating_alerts: operationalBundle.operating_alerts,
        operator_assist: authoritativeOperatorAssist,
        command_overlays: authoritativeOperatorAssist.command_overlays,
        outreach_recommendation: authoritativeOutreachRecommendation,
        native_revenue_decision:
          nativeDecisionBundle?.display_summary ??
          intelligence.native_revenue_decision ??
          null,
        native_meeting_prep_objective:
          nativeDecisionBundle?.meeting_prep_objective ??
          intelligence.native_meeting_prep_objective ??
          null,
        native_relationship_recommendation:
          nativeDecisionBundle?.relationship_recommendation ??
          intelligence.native_relationship_recommendation ??
          null,
        primary_contact_id:
          finalStrategy.primary_contact?.contact_id ??
          coverage.primary_recommended_contact_id ??
          intelligence.primary_contact_id,
        recommended_contact_id:
          finalStrategy.primary_contact?.contact_id ??
          coverage.primary_recommended_contact_id ??
          intelligence.recommended_contact_id,
      },
    }
  })
}

function buildProspectSearchPeopleRowDraft(input: {
  company: GrowthProspectSearchCompanyResult
  contact: GrowthProspectSearchContactIntelligence["contacts"][number]
  intelligence: GrowthProspectSearchContactIntelligence | null | undefined
  profile: ReturnType<typeof buildPeopleContactProfile>
  source_label: string | null
  source_page_url: string | null
  phone_on_dnc: boolean | null
  name: string
}): GrowthProspectSearchPeopleResultRow {
  const { company, contact, profile, source_label, source_page_url, phone_on_dnc, name } = input
  return {
    id: `${company.source_type}:${company.id}:${contact.id}`,
    source_type: company.source_type,
    company_id: company.id,
    company_name: company.company_name,
    full_name: name,
    title: contact.title,
    email: contact.email ?? null,
    phone: contact.phone ?? null,
    role: contact.role_type,
    verification_status: profile.verification_status,
    rank_score: profile.confidenceReasoning.confidence_score,
    company,
    contact_id: contact.id,
    email_reason: profile.email_reason,
    phone_reason: profile.phone_reason,
    source_label,
    source_page_url,
    confidence: profile.confidenceReasoning.confidence_score,
    location: company.location,
    compliance_status: profile.readiness.compliance_status,
    last_checked_at: profile.freshness.last_checked_at,
    outreach_ready: profile.eligibility.email.eligible || profile.eligibility.call.eligible,
    email_available: profile.readiness.email_available,
    phone_available: profile.readiness.phone_available,
    call_ready: profile.eligibility.call_ready,
    sms_ready: profile.eligibility.sms_ready,
    readiness_label:
      profile.stale_warning ??
      (profile.eligibility.call.eligible
        ? "Call ready"
        : profile.eligibility.email.eligible
          ? "Email outreach ready"
          : profile.readiness.readiness_label),
    email_eligibility: profile.eligibility.email.state,
    call_eligibility: profile.eligibility.call.state,
    sms_eligibility: profile.eligibility.sms.state,
    call_block_reason: profile.eligibility.call_block_reason,
    sms_block_reason: profile.eligibility.sms_block_reason,
    phone_on_dnc,
    discovered_at: profile.freshness.discovered_at,
    last_verified_at: profile.freshness.last_verified_at,
    source_last_seen_at: profile.freshness.source_last_seen_at,
    verification_expires_at: profile.freshness.verification_expires_at,
    freshness_status: profile.freshness.freshness_status,
    email_verification_depth: profile.email_verification_depth,
    phone_verification_depth: profile.phone_verification_depth,
    confidence_label: profile.confidenceReasoning.confidence_label,
    confidence_reason: profile.confidenceReasoning.summary,
    confidence_top_reasons: profile.confidenceReasoning.top_reasons,
    confidence_risk_notes: profile.confidenceReasoning.risk_notes,
    stale_warning: profile.stale_warning,
    persona: profile.persona,
    persona_type: profile.persona.persona_type,
    persona_label: profile.persona.persona_label,
    persona_icp_relevance: profile.persona.icp_relevance,
    persona_buying_influence: profile.persona.buying_influence,
    persona_outreach_suitability: profile.persona.outreach_suitability,
    persona_evidence: profile.persona.evidence,
    outreach_rank_score: 0,
    priority_tier: "review",
    ranking_reasons: [],
    ranking_risks: [],
    recommended_next_action: "Pending ranking",
    is_recommended_contact: false,
    is_secondary_contact: false,
    influence_score: 0,
    influence_tier: "unknown",
    influence_reasons: [],
    likely_department: "general",
    sequencing_role: null,
    sequencing_note: null,
    outreach_sequence_position: null,
    relationship_status: "new",
    relationship_momentum: "stable",
    relationship_strength_score: 0,
    relationship_last_interaction_at: null,
    relationship_summary: null,
    source_page_type: contact.source_page_type ?? null,
    email_classification: contact.email_classification ?? null,
    phone_classification: contact.phone_classification ?? null,
    evidence_quality_score: contact.evidence_quality_score ?? null,
    evidence_quality_label: contact.evidence_quality_label ?? null,
    evidence_quality_reasons: contact.evidence_quality_reasons ?? [],
    extraction_risks: contact.extraction_risks ?? [],
    branch_name: contact.branch_name ?? null,
    branch_city: contact.branch_city ?? null,
    branch_state: contact.branch_state ?? null,
    branch_phone: contact.branch_phone ?? null,
    location_confidence: contact.location_confidence ?? null,
    linkedin_company_url: contact.linkedin_company_url ?? null,
    linkedin_reference_label: contact.linkedin_reference_label ?? null,
    contact_identity_key: contact.contact_identity_key ?? null,
    identity_confidence: contact.identity_confidence ?? null,
    merge_confidence: contact.merge_confidence ?? null,
    conflict_status: contact.conflict_status ?? null,
    source_count: contact.source_count ?? null,
    operator_confirmed: contact.operator_confirmed === true,
    identity_resolution: contact.identity_resolution ?? null,
    timeline_events: buildProspectSearchPeopleTimelineEvents({
      contact,
      company,
      source_label,
      freshness: profile.freshness,
      email_verification_depth: profile.email_verification_depth,
      phone_verification_depth: profile.phone_verification_depth,
      eligibility: profile.eligibility,
      persona: profile.persona,
      ranking: null,
    }),
  }
}

export function buildProspectSearchPeopleRowsFromCompanies(
  companies: GrowthProspectSearchCompanyResult[],
): GrowthProspectSearchPeopleResultRow[] {
  const rows: GrowthProspectSearchPeopleResultRow[] = []

  for (const company of companies) {
    const intelligence = company.contact_intelligence
    const contacts = intelligence?.contacts ?? []
    for (const contact of contacts) {
      const name = contact.name?.trim()
      if (!name) continue

      const sourceEvidence = contact.source_evidence[0]
      const source_label = formatProspectSearchContactSourceLabel({
        source_label:
          contact.source_label ??
          (sourceEvidence
            ? formatWebsiteExtractEvidenceLabel({
                source_type: "website",
                source_evidence: [
                  {
                    claim: sourceEvidence.claim,
                    evidence: sourceEvidence.evidence,
                    source: sourceEvidence.source,
                    page_url: sourceEvidence.page_url ?? null,
                  },
                ],
              })
            : intelligence?.source_labels[0] ?? null),
        source_page_url: contact.source_page_url ?? sourceEvidence?.page_url ?? null,
      })
      const phone_on_dnc =
        typeof (contact as { phone_on_dnc?: unknown }).phone_on_dnc === "boolean"
          ? ((contact as { phone_on_dnc: boolean }).phone_on_dnc as boolean)
          : null
      const profile = buildPeopleContactProfile({
        contact,
        company,
        source_label,
        source_page_url: contact.source_page_url ?? sourceEvidence?.page_url ?? null,
        phone_on_dnc,
        email_suppressed:
          typeof (contact as { email_suppressed?: unknown }).email_suppressed === "boolean"
            ? (contact as { email_suppressed: boolean }).email_suppressed
            : false,
      })

      rows.push(
        buildProspectSearchPeopleRowDraft({
          company,
          contact,
          intelligence,
          profile,
          source_label,
          source_page_url: contact.source_page_url ?? sourceEvidence?.page_url ?? null,
          phone_on_dnc,
          name,
        }),
      )
    }
  }

  return enrichProspectSearchPeopleRowsWithRanking(rows)
}

export function countProspectSearchPeopleRows(
  companies: GrowthProspectSearchCompanyResult[],
): number {
  return buildProspectSearchPeopleRowsFromCompanies(companies).length
}

export function resolveDefaultProspectSearchResultMode(input: {
  companies: GrowthProspectSearchCompanyResult[]
  filters: GrowthProspectSearchFilters
  serverPeopleCount?: number
}): ProspectSearchResultMode {
  const hydratedPeopleCount =
    countProspectSearchPeopleRows(input.companies) + (input.serverPeopleCount ?? 0)
  if (hydratedPeopleCount === 0) return "companies"
  return "people"
}

export function mergeProspectSearchPeopleResults(
  serverPeople: GrowthProspectSearchPersonResult[],
  companies: GrowthProspectSearchCompanyResult[],
): GrowthProspectSearchPeopleResultRow[] {
  const fromIntelligence = buildProspectSearchPeopleRowsFromCompanies(companies)
  const seen = new Set(fromIntelligence.map((row) => row.id))

  for (const person of serverPeople) {
    const company = companies.find((row) => row.id === person.company_id)
    if (!company) continue
    const rowId = `${person.source_type}:${person.company_id}:${person.id}`
    if (seen.has(rowId)) continue
    const matchingContact = company.contact_intelligence?.contacts.find(
      (c) => c.id === person.id || c.name === person.full_name,
    )
    if (matchingContact) {
      const built = buildProspectSearchPeopleRowsFromCompanies([company]).find((r) => r.id === rowId)
      if (built) {
        fromIntelligence.push(built)
        seen.add(rowId)
        continue
      }
    }
    const freshness = resolveProspectSearchContactFreshness({})
    const email_verification_depth = classifyProspectSearchEmailVerificationDepth({
      email: person.email,
    })
    const phone_verification_depth = classifyProspectSearchPhoneVerificationDepth({
      phone: person.phone,
    })
    const eligibility = resolveContactOutreachEligibilityBundle({
      email: person.email,
      phone: person.phone,
      verification_status: "pending_verification",
      confidence: person.rank_score,
      company_suppressed: company.is_suppressed,
      contact_suppressed: company.is_suppressed,
      phone_on_dnc: null,
      freshness_status: freshness.freshness_status,
      email_verification_depth,
      phone_verification_depth,
    })
    const confidenceReasoning = buildProspectSearchContactConfidenceReasoning({
      confidence: person.rank_score,
      email: person.email,
      phone: person.phone,
      title: person.title,
      freshness_status: freshness.freshness_status,
      email_verification_depth,
      phone_verification_depth,
      company_suppressed: company.is_suppressed,
    })
    const persona = resolveProspectSearchRevenuePersona({
      title: person.title,
      industry: company.industry,
    })
    fromIntelligence.push({
      ...person,
      company,
      contact_id: person.id,
      email_reason: resolveProspectSearchContactFieldReason({
        value: person.email,
        company,
        channel: "email",
      }),
      phone_reason: resolveProspectSearchContactFieldReason({
        value: person.phone,
        company,
        channel: "phone",
      }),
      source_label: person.source_type,
      source_page_url: null,
      confidence: confidenceReasoning.confidence_score,
      location: company.location ?? null,
      compliance_status: company.is_suppressed ? "suppressed" : "review_required",
      last_checked_at: null,
      outreach_ready: eligibility.email.eligible || eligibility.call.eligible,
      email_available: Boolean(person.email?.trim()),
      phone_available: Boolean(person.phone?.trim()),
      call_ready: eligibility.call_ready,
      sms_ready: eligibility.sms_ready,
      readiness_label:
        resolveProspectSearchStaleWarning({
          freshness_status: freshness.freshness_status,
          email: person.email,
          phone: person.phone,
          email_verification_depth,
          phone_verification_depth,
          call_eligibility: eligibility.call.state,
        }) ?? (company.is_suppressed ? "Suppressed for outreach" : "Needs verification"),
      email_eligibility: eligibility.email.state,
      call_eligibility: eligibility.call.state,
      sms_eligibility: eligibility.sms.state,
      call_block_reason: eligibility.call_block_reason,
      sms_block_reason: eligibility.sms_block_reason,
      phone_on_dnc: null,
      discovered_at: null,
      last_verified_at: null,
      source_last_seen_at: null,
      verification_expires_at: null,
      freshness_status: freshness.freshness_status,
      email_verification_depth,
      phone_verification_depth,
      confidence_label: confidenceReasoning.confidence_label,
      confidence_reason: confidenceReasoning.summary,
      confidence_top_reasons: confidenceReasoning.top_reasons,
      confidence_risk_notes: confidenceReasoning.risk_notes,
      stale_warning: resolveProspectSearchStaleWarning({
        freshness_status: freshness.freshness_status,
        email: person.email,
        phone: person.phone,
        email_verification_depth,
        phone_verification_depth,
        call_eligibility: eligibility.call.state,
      }),
      persona,
      persona_type: persona.persona_type,
      persona_label: persona.persona_label,
      persona_icp_relevance: persona.icp_relevance,
      persona_buying_influence: persona.buying_influence,
      persona_outreach_suitability: persona.outreach_suitability,
      persona_evidence: persona.evidence,
      outreach_rank_score: 0,
      priority_tier: "review" as const,
      ranking_reasons: [],
      ranking_risks: [],
      recommended_next_action: "Review contact evidence",
      is_recommended_contact: false,
      is_secondary_contact: false,
      influence_score: 0,
      influence_tier: "unknown",
      influence_reasons: [],
      likely_department: "general",
      sequencing_role: null,
      sequencing_note: null,
      outreach_sequence_position: null,
      relationship_status: "new",
      relationship_momentum: "stable",
      relationship_strength_score: 0,
      relationship_last_interaction_at: null,
      relationship_summary: null,
      source_page_type: null,
      email_classification: null,
      phone_classification: null,
      evidence_quality_score: null,
      evidence_quality_label: null,
      evidence_quality_reasons: [],
      extraction_risks: [],
      branch_name: null,
      branch_city: null,
      branch_state: null,
      branch_phone: null,
      location_confidence: null,
      linkedin_company_url: null,
      linkedin_reference_label: null,
      contact_identity_key: null,
      identity_confidence: null,
      merge_confidence: null,
      conflict_status: null,
      source_count: null,
      operator_confirmed: false,
      identity_resolution: null,
      timeline_events: [
        {
          id: "discovered-server",
          kind: "discovered",
          label: "Discovered",
          detail: "Server people index record",
          occurred_at: null,
        },
      ],
    } as GrowthProspectSearchPeopleResultRow)
    seen.add(rowId)
  }

  return enrichProspectSearchPeopleRowsWithRanking(fromIntelligence)
}

function buildProspectSearchPeopleTimelineEvents(input: {
  contact: GrowthProspectSearchContactIntelligence["contacts"][number]
  company: GrowthProspectSearchCompanyResult
  source_label: string | null
  freshness?: ReturnType<typeof resolveProspectSearchContactFreshness>
  email_verification_depth?: ProspectSearchEmailVerificationDepth
  phone_verification_depth?: ProspectSearchPhoneVerificationDepth
  eligibility?: ReturnType<typeof resolveContactOutreachEligibilityBundle>
  persona?: ProspectSearchRevenuePersonaIntelligence
  ranking?: Pick<
    import("@/lib/growth/prospect-search/prospect-search-contact-ranking").ProspectSearchContactRankingResult,
    "priority_tier" | "outreach_rank_score" | "ranking_reasons" | "recommended_next_action"
  > | null
}): ProspectSearchPeopleTimelineEvent[] {
  const events: ProspectSearchPeopleTimelineEvent[] = [
    {
      id: "discovered",
      kind: "discovered",
      label: "Discovered",
      detail: input.source_label ?? "Evidence-backed contact discovered",
      occurred_at: input.freshness?.discovered_at ?? input.contact.last_checked_at ?? null,
    },
  ]
  if (input.email_verification_depth || input.phone_verification_depth) {
    events.push({
      id: "verification",
      kind: "verification",
      label: "Verification",
      detail: [
        input.email_verification_depth
          ? `Email: ${input.email_verification_depth.replace(/_/g, " ")}`
          : null,
        input.phone_verification_depth
          ? `Phone: ${input.phone_verification_depth.replace(/_/g, " ")}`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
      occurred_at: input.freshness?.last_verified_at ?? input.contact.last_checked_at ?? null,
    })
  }
  if (input.contact.verification_status?.includes("verified")) {
    events.push({
      id: "verified",
      kind: "verified",
      label: "Verified",
      detail: `Verification state: ${input.contact.verification_status.replace(/_/g, " ")}`,
      occurred_at: input.freshness?.last_verified_at ?? input.contact.last_checked_at ?? null,
    })
  }
  if (input.freshness) {
    events.push({
      id: "freshness",
      kind: "freshness",
      label: "Freshness",
      detail: `Status: ${input.freshness.freshness_status.replace(/_/g, " ")}${
        input.freshness.last_checked_at
          ? ` · last checked ${new Date(input.freshness.last_checked_at).toLocaleDateString()}`
          : ""
      }`,
      occurred_at: input.freshness.last_checked_at,
    })
  }
  if (input.eligibility) {
    events.push({
      id: "eligibility",
      kind: "verification",
      label: "Eligibility snapshot",
      detail: `Email ${input.eligibility.email.state} · Call ${input.eligibility.call.state} · SMS ${input.eligibility.sms.state}`,
      occurred_at: input.freshness?.last_checked_at ?? null,
    })
  }
  if (input.persona && input.persona.persona_type !== "unknown") {
    events.push({
      id: "persona",
      kind: "verification",
      label: "Persona",
      detail: `${input.persona.persona_label} · ICP relevance ${Math.round(input.persona.icp_relevance * 100)}%`,
      occurred_at: input.freshness?.last_checked_at ?? null,
    })
  }
  if (input.ranking) {
    events.push({
      id: "ranking",
      kind: "freshness",
      label: "Outreach ranking",
      detail: `${input.ranking.priority_tier.replace(/_/g, " ")} · score ${Math.round(input.ranking.outreach_rank_score * 100)} · ${input.ranking.recommended_next_action}`,
      occurred_at: input.freshness?.last_checked_at ?? null,
    })
  }
  if (input.company.is_suppressed) {
    events.push({
      id: "suppressed",
      kind: "suppressed",
      label: "Suppressed",
      detail: input.company.suppression_reason ?? "Company suppressed for outreach",
      occurred_at: input.company.suppressed_at ?? null,
    })
  }
  return events
}

function resolveContactVerificationStatus(
  contact: GrowthProspectSearchContactIntelligence["contacts"][number],
  company: GrowthProspectSearchCompanyResult,
  depths?: {
    email_verification_depth: ProspectSearchEmailVerificationDepth
    phone_verification_depth: ProspectSearchPhoneVerificationDepth
  },
): string {
  if (company.is_suppressed) return "suppressed"
  if (depths) {
    const emailOk = emailDepthImpliesVerified(depths.email_verification_depth)
    const phoneOk = phoneDepthImpliesCallable(depths.phone_verification_depth)
    if (emailOk && phoneOk) return "verified_channels"
    if (emailOk) return "email_verified"
    if (phoneOk) return "phone_verified"
    if (depths.email_verification_depth === "verification_needed") return "pending_verification"
    if (depths.phone_verification_depth === "verification_needed") return "pending_verification"
  }
  if (contact.email?.trim() && contact.phone?.trim()) return "verified_channels"
  if (contact.email?.trim()) return "email_verified"
  if (contact.phone?.trim()) return "phone_verified"
  if (contact.name.trim()) return "pending_verification"
  return "not_found"
}

export function buildProspectSearchContactProviderMissingMessage(
  company: GrowthProspectSearchCompanyResult,
): string {
  const state = resolveProspectSearchContactProviderState(company)
  if (company.website?.trim()) {
    return "Run Find contacts to extract publicly listed names, emails, and phones from the company website."
  }
  if (state === "no_provider_connected") {
    return "No website on file — add a website or connect a paid contact provider for deeper research."
  }
  return "Contact research needed before outreach."
}

export function logProspectSearchContactRefresh(input: {
  userId?: string | null
  scope: "selected" | "visible" | "stale" | "company"
  count: number
  company_ids?: string[]
}): void {
  console.info(
    JSON.stringify({
      source: "growth-prospect-search",
      event: "contact_refresh",
      qa_marker: GROWTH_CONTACT_FRESHNESS_QA_MARKER,
      ts: new Date().toISOString(),
      user_id: input.userId ?? null,
      scope: input.scope,
      count: input.count,
      company_ids: input.company_ids ?? [],
    }),
  )
}

export function appendProspectSearchPeopleRefreshEvent(
  row: Pick<GrowthProspectSearchPeopleResultRow, "timeline_events">,
): ProspectSearchPeopleTimelineEvent[] {
  return [
    ...row.timeline_events,
    {
      id: `refreshed-${Date.now()}`,
      kind: "refreshed",
      label: "Refresh requested",
      detail: "Operator triggered verification refresh — internal providers will rerun",
      occurred_at: new Date().toISOString(),
    },
  ]
}

export function logProspectSearchContactDiscoveryIssue(
  code: string,
  context: Record<string, string | null | undefined> = {},
): void {
  if (typeof console === "undefined" || typeof console.warn !== "function") return
  console.warn(`[${GROWTH_PROSPECT_CONTACT_DISCOVERY_QA_MARKER}]`, code, context)
}
