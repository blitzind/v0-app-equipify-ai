/**
 * AVA-GROWTH-OPERATOR-1C — Canonical escalation authority types (client-safe).
 */

import type { GrowthCanonicalOpportunityAuthority } from "@/lib/growth/aios/authority/growth-canonical-opportunity-authority-types-1b"

export const GROWTH_AIOS_GROWTH_OPERATOR_1C_QA_MARKER =
  "ava-growth-operator-1c-canonical-escalation-authority-v1" as const

export const GROWTH_CANONICAL_ESCALATION_AUTHORITY_RULE =
  "One canonical escalation policy governs every Growth subsystem — no independent operator interrupts outside constitutional categories." as const

/** Constitutional escalation disposition categories (AVA-GROWTH-OPERATOR-1A). */
export const GROWTH_CANONICAL_ESCALATION_CATEGORIES = [
  "autonomous",
  "operator_approval",
  "strategic_approval",
  "never_escalate",
  "always_escalate",
] as const

export type GrowthCanonicalEscalationCategory = (typeof GROWTH_CANONICAL_ESCALATION_CATEGORIES)[number]

/** Subsystem escalation request kinds — all defer to canonical policy. */
export const GROWTH_CANONICAL_ESCALATION_REQUEST_KINDS = [
  "outbound_send_ready",
  "material_reply_response",
  "mission_blocker",
  "kill_switch_active",
  "pilot_failure_threshold",
  "revenue_operator_critical",
  "strategic_direction_change",
  "spending_approval_required",
  "high_stakes_relationship",
  "calibration_apply_ready",
  "admission_terminal_reject",
  "admission_edge_review",
  "research_execution_plan",
  "prepare_outreach",
  "continue_research",
  "qualification_complete",
  "personalization_complete",
  "outreach_package_prepared",
  "request_human_review",
  "meta_recommender_advisory",
  "work_manager_operator_queue",
  "waiting_on_you_item",
  "daily_queue_item",
  "generic_operator_review",
] as const

export type GrowthCanonicalEscalationRequestKind =
  (typeof GROWTH_CANONICAL_ESCALATION_REQUEST_KINDS)[number]

export type GrowthCanonicalEscalationDecision = {
  qaMarker: typeof GROWTH_AIOS_GROWTH_OPERATOR_1C_QA_MARKER
  interruptOperator: boolean
  category: GrowthCanonicalEscalationCategory
  reasonCode: string
  constitutionalRef: string | null
  accomplishmentOnly: boolean
  operatorApprovalRequired: boolean
  strategicApprovalRequired: boolean
  suppressionApplied: boolean
  authorityBound: boolean
}

export type GrowthCanonicalEscalationEvaluationInput = {
  requestKind: GrowthCanonicalEscalationRequestKind
  leadId?: string | null
  sourceSubsystem?: string | null
  opportunityAuthority?: GrowthCanonicalOpportunityAuthority | null
  signals?: {
    sendReady?: boolean
    packagePendingApproval?: boolean
    missionBlocker?: boolean
    killSwitchActive?: boolean
    pilotFailures?: number
    revenueOperatorEscalation?: "none" | "low" | "medium" | "high" | "critical"
    spendingApprovalRequired?: boolean
    highStakesRelationship?: boolean
    calibrationProposalReady?: boolean
    terminalRejectReasons?: string[]
    admissionState?: string | null
    leadStatus?: string | null
    preparationComplete?: boolean
    researchComplete?: boolean
  }
}

export type GrowthEscalationAgreementTelemetryRow = {
  leadId: string | null
  subsystem: string
  requestKind: GrowthCanonicalEscalationRequestKind
  subsystemWouldInterrupt: boolean
  canonicalInterrupt: boolean
  agreement: boolean
  ownershipAgreement: boolean
  escalationAgreement: boolean
  reasonCode: string
}

export type GrowthEscalationAgreementSnapshot = {
  qaMarker: typeof GROWTH_AIOS_GROWTH_OPERATOR_1C_QA_MARKER
  generatedAt: string
  samples: number
  authorityAgreementPercent: number
  escalationAgreementPercent: number
  ownershipAgreementPercent: number
  autonomousExecutionPercent: number
  unexpectedOverrideCount: number
  rows: GrowthEscalationAgreementTelemetryRow[]
}
