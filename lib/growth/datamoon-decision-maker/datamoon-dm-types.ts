/** SV1-4 — DataMoon decision-maker enrichment types (client-safe). */

import type { AiOsInvestmentState } from "@/lib/growth/resource-allocation/resource-allocation-types"

export const AI_OS_DATAMOON_DM_QA_MARKER = "sv1-4-datamoon-decision-maker-enrichment-v1" as const

export const AI_OS_DATAMOON_DM_OUTCOMES = [
  "verified_decision_maker",
  "probable_decision_maker",
  "supporting_stakeholder",
  "insufficient_contact_data",
  "company_match_uncertain",
  "no_suitable_person",
  "provider_exhausted",
  "retry_later",
  "skipped_existing_sufficient",
  "denied_authorization",
] as const

export type AiOsDatamoonDmOutcome = (typeof AI_OS_DATAMOON_DM_OUTCOMES)[number]

export const AI_OS_DATAMOON_DM_DENY_REASONS = [
  "stop_investment",
  "reduce_investment",
  "not_portfolio_selected",
  "provider_disabled",
  "provider_not_configured",
  "budget_exhausted",
  "disqualified_lead",
  "research_incomplete",
  "company_identity_uncertain",
  "sufficient_dm_exists",
  "recent_equivalent_no_result",
  "retry_limit_reached",
  "kill_switch",
  "person_not_required",
] as const

export type AiOsDatamoonDmDenyReason = (typeof AI_OS_DATAMOON_DM_DENY_REASONS)[number]

export const AI_OS_DATAMOON_DM_RETRY = {
  maxAttemptsPerLead: 3,
  minHoursBetweenEquivalentRequests: 24,
  noResultCooldownHours: 72,
  idempotencyTtlHours: 24,
} as const

/** Default title families for field-service / equipment ICP — deterministic, no LLM. */
export const AI_OS_DATAMOON_DM_DEFAULT_TITLE_FAMILIES = [
  "Owner",
  "President",
  "CEO",
  "VP Operations",
  "Director of Operations",
  "Service Manager",
  "General Manager",
  "Director of Biomedical Engineering",
] as const

export type AiOsDatamoonDmRequirement = {
  personRequired: boolean
  titleFamilies: string[]
  existingPersonSufficient: boolean
  existingPersonIncompleteWorthEnriching: boolean
  anotherPersonNeeded: boolean
  searchAlreadyAttempted: boolean
  retryJustified: boolean
  earnedEnrichmentSpend: boolean
  reason: string
}

export type AiOsDatamoonDmAuthorization = {
  authorized: boolean
  denyReason: AiOsDatamoonDmDenyReason | null
  investmentState: AiOsInvestmentState | "unknown"
  portfolioSelected: boolean
  providerEnabled: boolean
  providerConfigured: boolean
  budgetAvailable: boolean
  reason: string
  /** Facade decisions recorded for parity; SV1-1/2 remain shadow for broad enforcement. */
  resourceAllocationSpendAuthorized: boolean | null
  estimatedResourceClass: "datamoon_person_enrichment"
}

export type AiOsDatamoonDmCandidate = {
  fullName: string
  title: string | null
  email: string | null
  phone: string | null
  linkedinUrl: string | null
  companyName: string | null
  companyDomain: string | null
  providerRecordId: string | null
  titleScore: number
  seniorityBoost: number
  hasVerifiedEmail: boolean
  hasCallablePhone: boolean
  companyMatchConfidence: number
  compositeScore: number
  outcomeClass: AiOsDatamoonDmOutcome
  evidence: string[]
}

export type AiOsDatamoonDmContactReadiness = {
  hasVerifiedEmail: boolean
  hasVerifiedPhone: boolean
  hasProfileUrl: boolean
  usableChannel: "email" | "phone" | "profile" | "none"
  unblocksEmailDrafting: boolean
  unblocksCallPackage: boolean
  reason: string
}

export type AiOsDatamoonDmExplainability = {
  whyDecisionMakerNeeded: string
  whyDatamoonSelected: string
  whyAccountEarnedSpend: string
  searchCriteria: string[]
  candidateCount: number
  whySelectedOutranked: string | null
  contactVerificationStatus: string
  estimatedCostClass: "datamoon_person_enrichment"
  pipelineDisposition: string
  providerProvenance: string[]
}

export type AiOsDatamoonDmDecision = {
  qaMarker: typeof AI_OS_DATAMOON_DM_QA_MARKER
  leadId: string
  organizationId: string
  outcome: AiOsDatamoonDmOutcome
  authorized: boolean
  denyReason: AiOsDatamoonDmDenyReason | null
  requirement: AiOsDatamoonDmRequirement
  authorization: AiOsDatamoonDmAuthorization
  selectedCandidate: AiOsDatamoonDmCandidate | null
  rankedCandidates: AiOsDatamoonDmCandidate[]
  contactReadiness: AiOsDatamoonDmContactReadiness | null
  providerCalled: boolean
  duplicateRequestPrevented: boolean
  idempotencyKey: string | null
  resumeDraftFactoryTo: "personalization" | "waiting_for_dm" | "paused" | "failed" | null
  explainability: AiOsDatamoonDmExplainability
  decidedAt: string
}
