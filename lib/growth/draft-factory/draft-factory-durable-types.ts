/** SV1-5 — Durable event-driven Draft Factory types (client-safe). */

export const AI_OS_DRAFT_FACTORY_DURABLE_QA_MARKER =
  "sv1-5-durable-event-driven-draft-factory-v1" as const

export const AI_OS_DRAFT_FACTORY_DURABLE_STATES = [
  "waiting_for_research",
  "research_complete",
  "waiting_for_dm",
  "waiting_for_contact_verification",
  "waiting_for_personalization",
  "waiting_for_generation",
  "draft_ready",
  "waiting_for_approval",
  "approved",
  "executed",
  "rejected",
  "paused",
  "failed",
] as const

export type AiOsDraftFactoryDurableState = (typeof AI_OS_DRAFT_FACTORY_DURABLE_STATES)[number]

export const AI_OS_DRAFT_FACTORY_DURABLE_STAGES = [
  "research",
  "qualification",
  "investment",
  "portfolio",
  "decision_maker",
  "contact_verification",
  "personalization",
  "generation",
  "approval",
  "complete",
] as const

export type AiOsDraftFactoryDurableStage = (typeof AI_OS_DRAFT_FACTORY_DURABLE_STAGES)[number]

export const AI_OS_DRAFT_FACTORY_CANONICAL_WAKES = [
  "new_lead",
  "research_required",
  "research_started",
  "research_completed",
  "research_failed",
  "research_became_stale",
  "qualification_changed",
  "investment_changed",
  "portfolio_selected",
  "portfolio_deferred",
  "capacity_available",
  "decision_maker_required",
  "datamoon_person_requested",
  "datamoon_person_completed",
  "datamoon_person_failed",
  "decision_maker_discovered",
  "decision_maker_rejected",
  "contact_verification_requested",
  "contact_verified",
  "contact_verification_failed",
  "personalization_required",
  "personalization_improved",
  "personalization_failed",
  "generation_required",
  "generation_completed",
  "generation_failed",
  "approval_package_created",
  "approval_rejected",
  "approval_approved",
  "company_changed",
  "mission_changed",
  "manual_rebuild",
  "scheduled_resume",
] as const

export type AiOsDraftFactoryCanonicalWake = (typeof AI_OS_DRAFT_FACTORY_CANONICAL_WAKES)[number]

/** Legacy → canonical wake normalization. */
export const AI_OS_DRAFT_FACTORY_WAKE_NORMALIZATION: Record<string, AiOsDraftFactoryCanonicalWake> = {
  new_lead: "new_lead",
  stale_research: "research_became_stale",
  newly_available_capacity: "capacity_available",
  provider_capacity_available: "capacity_available",
  portfolio_selected: "portfolio_selected",
  decision_maker_discovered: "decision_maker_discovered",
  decision_maker_required: "decision_maker_required",
  datamoon_person_requested: "datamoon_person_requested",
  datamoon_person_completed: "datamoon_person_completed",
  datamoon_person_failed: "datamoon_person_failed",
  decision_maker_rejected: "decision_maker_rejected",
  contact_verified: "contact_verified",
  contact_verification_failed: "contact_verification_failed",
  personalization_improved: "personalization_improved",
  approval_rejected: "approval_rejected",
  company_changed: "company_changed",
  manual_rebuild: "manual_rebuild",
  outreach_preparation_wake: "generation_required",
  scheduled_resume: "scheduled_resume",
}

export const AI_OS_DRAFT_FACTORY_ADVANCE_OUTCOMES = [
  "completed",
  "waiting",
  "deferred",
  "retryable_failure",
  "terminal_failure",
  "stopped",
  "duplicate_noop",
] as const

export type AiOsDraftFactoryAdvanceOutcome = (typeof AI_OS_DRAFT_FACTORY_ADVANCE_OUTCOMES)[number]

export type AiOsDraftFactoryAttemptCounts = {
  research: number
  decisionMaker: number
  contactVerification: number
  personalization: number
  generation: number
}

export type AiOsDraftFactoryDurableLeadState = {
  organizationId: string
  leadId: string
  state: AiOsDraftFactoryDurableState
  earliestIncompleteStage: AiOsDraftFactoryDurableStage | null
  version: number
  packageId: string | null
  researchRunId: string | null
  decisionMakerId: string | null
  personalizationId: string | null
  lastWakeType: AiOsDraftFactoryCanonicalWake | null
  lastWakeAt: string | null
  nextEligibleWakeAt: string | null
  attemptCounts: AiOsDraftFactoryAttemptCounts
  lastErrorCode: string | null
  lastErrorStage: string | null
  pausedReason: string | null
  leaseOwner: string | null
  leaseExpiresAt: string | null
  createdAt: string
  updatedAt: string
}

export type AiOsDraftFactoryCanonicalEvidence = {
  admitted: boolean
  researchCurrent: boolean
  researchRunId?: string | null
  knowledgeComplete: boolean
  investmentState?: string | null
  stopInvestment: boolean
  portfolioSelected: boolean
  decisionMakerAvailable: boolean
  decisionMakerId?: string | null
  contactVerifiedForEmail: boolean
  personalizationReady: boolean
  personalizationId?: string | null
  draftValid: boolean
  packageId?: string | null
  approved: boolean
  rejected: boolean
  paused?: boolean
  failed?: boolean
}

export type AiOsDraftFactoryWakeInput = {
  type: string
  sourceId?: string | null
  sourceVersion?: string | null
  eventId?: string | null
  rejectionScope?: "copy" | "person" | "channel" | "sequence" | "qualification" | "account" | null
  requestId?: string | null
}

export type AiOsDraftFactoryAdvanceResultV5 = {
  qaMarker: typeof AI_OS_DRAFT_FACTORY_DURABLE_QA_MARKER
  organizationId: string
  leadId: string
  wakeType: AiOsDraftFactoryCanonicalWake
  wakeFingerprint: string
  outcome: AiOsDraftFactoryAdvanceOutcome
  previousState: AiOsDraftFactoryDurableState | null
  nextState: AiOsDraftFactoryDurableState
  previousStage: AiOsDraftFactoryDurableStage | null
  nextStage: AiOsDraftFactoryDurableStage | null
  stageEvaluated: AiOsDraftFactoryDurableStage | null
  reason: string
  packageId: string | null
  transportBlocked: true
  pendingHumanApproval: true
  duplicate: boolean
  state: AiOsDraftFactoryDurableLeadState
  decidedAt: string
}

export function emptyAttemptCounts(): AiOsDraftFactoryAttemptCounts {
  return {
    research: 0,
    decisionMaker: 0,
    contactVerification: 0,
    personalization: 0,
    generation: 0,
  }
}
