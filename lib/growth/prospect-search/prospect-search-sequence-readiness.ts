/** Sequence readiness orchestration — deterministic, evidence-backed. Client-safe. */

import type { ProspectSearchAccountContactStrategy } from "@/lib/growth/prospect-search/prospect-search-account-contact-strategy"
import type { ProspectSearchCompanyContactCoverageIntelligence } from "@/lib/growth/prospect-search/prospect-search-company-contact-coverage-intelligence"
import type { ProspectSearchOpportunityEmergence } from "@/lib/growth/prospect-search/prospect-search-opportunity-emergence"
import type { ProspectSearchAccountProgression } from "@/lib/growth/prospect-search/prospect-search-account-progression"
import type { ProspectSearchRelationshipMemorySnapshot } from "@/lib/growth/prospect-search/prospect-search-relationship-memory"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthProspectSearchPeopleResultRow } from "@/lib/growth/prospect-search/prospect-search-contact-discovery"

export const GROWTH_SEQUENCE_READINESS_QA_MARKER = "growth-sequence-readiness-v1" as const

export const PROSPECT_SEARCH_SEQUENCE_READINESS_STATES = [
  "ready",
  "ready_with_review",
  "research_required",
  "verification_required",
  "blocked",
  "insufficient_coverage",
] as const

export type ProspectSearchSequenceReadinessState =
  (typeof PROSPECT_SEARCH_SEQUENCE_READINESS_STATES)[number]

export const PROSPECT_SEARCH_SEQUENCE_SUITABILITY_TYPES = [
  "call_first",
  "email_first",
  "relationship_nurture",
  "research_first",
  "manual_review",
  "do_not_sequence",
] as const

export type ProspectSearchSequenceSuitabilityType =
  (typeof PROSPECT_SEARCH_SEQUENCE_SUITABILITY_TYPES)[number]

export type ProspectSearchSequenceReadiness = {
  qa_marker: typeof GROWTH_SEQUENCE_READINESS_QA_MARKER
  readiness_state: ProspectSearchSequenceReadinessState
  sequence_suitability: ProspectSearchSequenceSuitabilityType
  readiness_reasons: string[]
  blockers: string[]
  missing_requirements: string[]
  safest_recommended_channel: string
  recommended_first_contact_id: string | null
  recommended_first_contact_name: string | null
  suggested_sequence_type: string
  readiness_score: number
}

export function resolveAccountSequenceReadiness(input: {
  company: GrowthProspectSearchCompanyResult
  peopleRows: GrowthProspectSearchPeopleResultRow[]
  coverage: ProspectSearchCompanyContactCoverageIntelligence
  accountStrategy: ProspectSearchAccountContactStrategy
  relationshipMemory?: ProspectSearchRelationshipMemorySnapshot | null
  accountProgression?: ProspectSearchAccountProgression | null
  opportunityEmergence?: ProspectSearchOpportunityEmergence | null
}): ProspectSearchSequenceReadiness {
  const readiness_reasons: string[] = []
  const blockers: string[] = []
  const missing_requirements: string[] = []

  const {
    company,
    peopleRows,
    coverage,
    accountStrategy,
    relationshipMemory,
    accountProgression,
    opportunityEmergence,
  } = input

  if (company.is_suppressed || accountStrategy.account_outreach_readiness === "blocked") {
    return {
      qa_marker: GROWTH_SEQUENCE_READINESS_QA_MARKER,
      readiness_state: "blocked",
      sequence_suitability: "do_not_sequence",
      readiness_reasons: ["Compliance block active"],
      blockers: [company.suppression_reason ?? "Account or contact suppressed"],
      missing_requirements: ["Resolve suppression before sequencing"],
      safest_recommended_channel: "blocked",
      recommended_first_contact_id: null,
      recommended_first_contact_name: null,
      suggested_sequence_type: "Do not sequence — compliance blocked",
      readiness_score: 0,
    }
  }

  const hasContacts = peopleRows.length > 0
  const callReady = peopleRows.some((row) => row.call_ready && row.call_eligibility === "eligible")
  const emailReady = peopleRows.some(
    (row) => row.email_available && row.email_eligibility === "eligible",
  )
  const staleContacts = peopleRows.filter(
    (row) => row.freshness_status === "stale" || row.freshness_status === "expired",
  ).length
  const identityConflictRows = peopleRows.filter(
    (row) =>
      row.conflict_status &&
      row.conflict_status !== "no_conflict" &&
      row.conflict_status !== "likely_same_person",
  )
  const primary = accountStrategy.primary_contact

  let readiness_state: ProspectSearchSequenceReadinessState = "insufficient_coverage"
  let sequence_suitability: ProspectSearchSequenceSuitabilityType = "research_first"
  let score = 0

  if (!hasContacts) {
    missing_requirements.push("At least one verified contact required")
    blockers.push("No contacts discovered")
  } else {
    score += 20
    readiness_reasons.push(`${peopleRows.length} contact(s) on account`)
  }

  if (coverage.persona_completeness >= 50) {
    score += 15
    readiness_reasons.push(`Persona completeness ${coverage.persona_completeness}%`)
  } else {
    missing_requirements.push("Operational persona coverage incomplete")
  }

  if (accountStrategy.account_outreach_readiness === "ready") {
    readiness_state = "ready"
    score += 25
    readiness_reasons.push("Account strategy marks outreach ready")
  } else if (accountStrategy.account_outreach_readiness === "ready_with_review") {
    readiness_state = "ready_with_review"
    score += 18
    readiness_reasons.push("Ready with operator review recommended")
  } else if (accountStrategy.account_outreach_readiness === "verification_needed") {
    readiness_state = "verification_required"
    blockers.push("Contact verification required")
    score += 8
  } else if (accountStrategy.account_outreach_readiness === "research_needed") {
    readiness_state = "research_required"
    blockers.push("Contact research needed before sequencing")
    score += 5
  } else if (!hasContacts || coverage.outreach_readiness_score < 30) {
    readiness_state = "insufficient_coverage"
    score += 3
  }

  if (staleContacts > 0 && staleContacts >= peopleRows.length / 2) {
    readiness_state = "verification_required"
    blockers.push("Majority of contacts have stale verification")
    score -= 10
  }

  if (identityConflictRows.length > 0) {
    if (readiness_state === "ready") {
      readiness_state = "ready_with_review"
    } else if (readiness_state === "ready_with_review") {
      // keep review state
    } else if (readiness_state !== "blocked") {
      readiness_state = "verification_required"
    }
    blockers.push(
      `${identityConflictRows.length} contact identity conflict(s) require operator review`,
    )
    missing_requirements.push("Resolve identity conflicts before confident sequencing")
    score -= Math.min(15, identityConflictRows.length * 5)
  }

  if (relationshipMemory?.relationship_status === "stalled") {
    sequence_suitability = "relationship_nurture"
    readiness_reasons.push("Stalled relationship — nurture before hard sequence")
  } else if (callReady && accountStrategy.recommended_channel === "call") {
    sequence_suitability = "call_first"
    readiness_reasons.push("Call-ready primary contact with eligible channel")
    score += 10
  } else if (emailReady && accountStrategy.recommended_channel === "email") {
    sequence_suitability = "email_first"
    readiness_reasons.push("Email-ready primary contact")
    score += 8
  } else if (
    opportunityEmergence?.emergence_tier === "relationship_building" ||
    relationshipMemory?.relationship_status === "warming"
  ) {
    sequence_suitability = "relationship_nurture"
    readiness_reasons.push("Relationship building phase — nurture sequence appropriate")
  } else if (readiness_state === "research_required" || readiness_state === "insufficient_coverage") {
    sequence_suitability = "research_first"
  } else if (readiness_state === "ready_with_review") {
    sequence_suitability = "manual_review"
  } else if (readiness_state === "ready" && callReady) {
    sequence_suitability = "call_first"
  } else if (readiness_state === "ready" && emailReady) {
    sequence_suitability = "email_first"
  }

  if (
    identityConflictRows.length > 0 &&
    (sequence_suitability === "call_first" || sequence_suitability === "email_first")
  ) {
    sequence_suitability = "manual_review"
    readiness_reasons.push("Identity conflicts require manual review before sequencing")
  }

  if (accountStrategy.missing_personas.length > 0) {
    missing_requirements.push(
      `Missing personas: ${accountStrategy.missing_personas.map((p) => p.replace(/_/g, " ")).join(", ")}`,
    )
  }
  if (accountStrategy.blocked_contacts.length > 0) {
    blockers.push(`${accountStrategy.blocked_contacts.length} blocked contact(s) in account strategy`)
  }

  if (
    opportunityEmergence?.emergence_tier === "accelerating" &&
    readiness_state === "ready"
  ) {
    score += 8
    readiness_reasons.push("Accelerating opportunity supports sequence readiness")
  }

  score = Math.round(Math.min(100, Math.max(0, score)))

  const suggested_sequence_type =
    sequence_suitability === "call_first"
      ? "Call-first coordinated outreach"
      : sequence_suitability === "email_first"
        ? "Email-first coordinated outreach"
        : sequence_suitability === "relationship_nurture"
          ? "Relationship nurture sequence"
          : sequence_suitability === "research_first"
            ? "Research-first — no outreach sequence yet"
            : sequence_suitability === "manual_review"
              ? "Manual operator review before sequencing"
              : "Do not sequence"

  return {
    qa_marker: GROWTH_SEQUENCE_READINESS_QA_MARKER,
    readiness_state,
    sequence_suitability,
    readiness_reasons: readiness_reasons.slice(0, 6),
    blockers: blockers.slice(0, 4),
    missing_requirements: missing_requirements.slice(0, 4),
    safest_recommended_channel: accountStrategy.recommended_channel,
    recommended_first_contact_id: primary?.contact_id ?? null,
    recommended_first_contact_name: primary?.full_name ?? null,
    suggested_sequence_type,
    readiness_score: score,
  }
}

export function resolveSequenceReadinessQueueBoost(
  readiness: ProspectSearchSequenceReadiness | null | undefined,
): number {
  if (!readiness || readiness.readiness_state === "blocked") return 0
  if (readiness.readiness_state === "ready") return 6
  if (readiness.readiness_state === "ready_with_review") return 3
  if (readiness.readiness_state === "verification_required") return -2
  if (readiness.readiness_state === "research_required" || readiness.readiness_state === "insufficient_coverage") {
    return -4
  }
  return 0
}
