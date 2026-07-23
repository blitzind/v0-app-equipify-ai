/**
 * AVA-GROWTH-OPERATOR-1C — Canonical escalation authority (client-safe).
 * Every subsystem defers operator-interrupt decisions to this module.
 */

import type { GrowthCanonicalOpportunityAuthority } from "@/lib/growth/aios/authority/growth-canonical-opportunity-authority-types-1b"
import { resolveCanonicalAuthorityRequiresOperator } from "@/lib/growth/aios/authority/growth-canonical-opportunity-authority-1b"
import {
  GROWTH_AIOS_GROWTH_OPERATOR_1C_QA_MARKER,
  GROWTH_CANONICAL_ESCALATION_AUTHORITY_RULE,
  type GrowthCanonicalEscalationCategory,
  type GrowthCanonicalEscalationDecision,
  type GrowthCanonicalEscalationEvaluationInput,
  type GrowthCanonicalEscalationRequestKind,
  type GrowthEscalationAgreementSnapshot,
  type GrowthEscalationAgreementTelemetryRow,
} from "@/lib/growth/aios/authority/growth-canonical-escalation-authority-types-1c"

export {
  GROWTH_AIOS_GROWTH_OPERATOR_1C_QA_MARKER,
  GROWTH_CANONICAL_ESCALATION_AUTHORITY_RULE,
} from "@/lib/growth/aios/authority/growth-canonical-escalation-authority-types-1c"
export type {
  GrowthCanonicalEscalationCategory,
  GrowthCanonicalEscalationDecision,
  GrowthCanonicalEscalationEvaluationInput,
  GrowthCanonicalEscalationRequestKind,
  GrowthEscalationAgreementSnapshot,
  GrowthEscalationAgreementTelemetryRow,
} from "@/lib/growth/aios/authority/growth-canonical-escalation-authority-types-1c"

/** Reasons that trigger autonomous terminal rejection — never operator review (R3). */
export const GROWTH_AUTONOMOUS_TERMINAL_REJECT_REASON_PREFIXES = [
  "negative_keyword:",
  "profile_disqualifier:",
  "known_icp_mismatch:",
  "icp_mismatch",
  "consumer_domain",
  "consumer_email",
  "invalid_company",
  "insurance",
  "utility",
  "foundation",
  "education",
  "government",
  "duplicate",
  "fit_below_terminal",
  "confidence_below_terminal",
  "operational_fit_not_established",
  "unsupported_service_model",
] as const

const ALWAYS_ESCALATE: GrowthCanonicalEscalationRequestKind[] = [
  "outbound_send_ready",
  "material_reply_response",
  "mission_blocker",
  "kill_switch_active",
  "calibration_apply_ready",
]

const NEVER_ESCALATE: GrowthCanonicalEscalationRequestKind[] = [
  "admission_terminal_reject",
  "continue_research",
  "qualification_complete",
  "personalization_complete",
  "outreach_package_prepared",
  "prepare_outreach",
  "meta_recommender_advisory",
]

const PREPARATION_ACCOMPLISHMENT: GrowthCanonicalEscalationRequestKind[] = [
  "continue_research",
  "qualification_complete",
  "personalization_complete",
  "outreach_package_prepared",
  "prepare_outreach",
]

function buildDecision(input: {
  interruptOperator: boolean
  category: GrowthCanonicalEscalationCategory
  reasonCode: string
  constitutionalRef?: string | null
  accomplishmentOnly?: boolean
  authorityBound?: boolean
  suppressionApplied?: boolean
}): GrowthCanonicalEscalationDecision {
  return {
    qaMarker: GROWTH_AIOS_GROWTH_OPERATOR_1C_QA_MARKER,
    interruptOperator: input.interruptOperator,
    category: input.category,
    reasonCode: input.reasonCode,
    constitutionalRef: input.constitutionalRef ?? null,
    accomplishmentOnly: input.accomplishmentOnly === true,
    operatorApprovalRequired: input.category === "operator_approval" || input.category === "always_escalate",
    strategicApprovalRequired: input.category === "strategic_approval",
    suppressionApplied: input.suppressionApplied === true,
    authorityBound: input.authorityBound === true,
  }
}

export function isAutonomousTerminalRejectReason(reason: string): boolean {
  const normalized = reason.trim().toLowerCase()
  if (!normalized) return false
  return GROWTH_AUTONOMOUS_TERMINAL_REJECT_REASON_PREFIXES.some((prefix) =>
    normalized.includes(prefix.replace(/:$/, "")),
  )
}

export function isAutonomousTerminalRejectFromSignals(
  signals: GrowthCanonicalEscalationEvaluationInput["signals"],
): boolean {
  if (!signals) return false
  if (signals.admissionState === "rejected" || signals.admissionState === "invalid") {
    const reasons = signals.terminalRejectReasons ?? []
    if (reasons.length === 0) return signals.admissionState === "rejected"
    return reasons.every((reason) => isAutonomousTerminalRejectReason(reason))
  }
  if (signals.leadStatus === "disqualified") return true
  return (signals.terminalRejectReasons ?? []).some(isAutonomousTerminalRejectReason)
}

function evaluateFromOpportunityAuthority(
  authority: GrowthCanonicalOpportunityAuthority,
  requestKind: GrowthCanonicalEscalationRequestKind,
): GrowthCanonicalEscalationDecision | null {
  if (authority.executionState === "terminal" || authority.nextAction === "disqualify") {
    return buildDecision({
      interruptOperator: false,
      category: "never_escalate",
      reasonCode: "canonical_authority_terminal_reject",
      constitutionalRef: "N1",
      accomplishmentOnly: true,
      authorityBound: true,
      suppressionApplied: true,
    })
  }

  if (PREPARATION_ACCOMPLISHMENT.includes(requestKind) && authority.currentStage === "preparation") {
    return buildDecision({
      interruptOperator: false,
      category: "autonomous",
      reasonCode: "preparation_accomplishment_not_blocker",
      constitutionalRef: "N3",
      accomplishmentOnly: true,
      authorityBound: true,
      suppressionApplied: true,
    })
  }

  if (requestKind === "outbound_send_ready") {
    const interrupt = authority.operatorReviewRequired || authority.transportBlocked
    return buildDecision({
      interruptOperator: interrupt,
      category: interrupt ? "always_escalate" : "autonomous",
      reasonCode: interrupt ? "send_ready_operator_approval" : "preparation_only",
      constitutionalRef: interrupt ? "E1" : "N3",
      accomplishmentOnly: !interrupt,
      authorityBound: true,
    })
  }

  if (requestKind === "prepare_outreach") {
    return buildDecision({
      interruptOperator: false,
      category: "autonomous",
      reasonCode: "preparation_accomplishment_not_blocker",
      constitutionalRef: "N3",
      accomplishmentOnly: true,
      authorityBound: true,
      suppressionApplied: true,
    })
  }

  if (resolveCanonicalAuthorityRequiresOperator(authority)) {
    return buildDecision({
      interruptOperator: true,
      category: "operator_approval",
      reasonCode: "canonical_authority_operator_required",
      constitutionalRef: "E2",
      authorityBound: true,
    })
  }

  if (authority.autonomousEligible) {
    return buildDecision({
      interruptOperator: false,
      category: "autonomous",
      reasonCode: "canonical_authority_autonomous",
      constitutionalRef: "N7",
      authorityBound: true,
      suppressionApplied: NEVER_ESCALATE.includes(requestKind),
    })
  }

  return null
}

/** Single canonical escalation evaluation — all subsystems call this. */
export function evaluateCanonicalEscalation(
  input: GrowthCanonicalEscalationEvaluationInput,
): GrowthCanonicalEscalationDecision {
  const signals = input.signals ?? {}

  if (input.opportunityAuthority) {
    const bound = evaluateFromOpportunityAuthority(input.opportunityAuthority, input.requestKind)
    if (bound) return bound
  }

  if (isAutonomousTerminalRejectFromSignals(signals)) {
    return buildDecision({
      interruptOperator: false,
      category: "never_escalate",
      reasonCode: "autonomous_terminal_reject",
      constitutionalRef: "N1",
      accomplishmentOnly: true,
      suppressionApplied: true,
    })
  }

  if (signals.killSwitchActive || input.requestKind === "kill_switch_active") {
    return buildDecision({
      interruptOperator: true,
      category: "always_escalate",
      reasonCode: "kill_switch_active",
      constitutionalRef: "E4",
    })
  }

  if (signals.missionBlocker || input.requestKind === "mission_blocker") {
    return buildDecision({
      interruptOperator: true,
      category: "always_escalate",
      reasonCode: "mission_blocker",
      constitutionalRef: "E3",
    })
  }

  if ((signals.pilotFailures ?? 0) >= 6 || input.requestKind === "pilot_failure_threshold") {
    return buildDecision({
      interruptOperator: true,
      category: "always_escalate",
      reasonCode: "pilot_failure_threshold",
      constitutionalRef: "E5",
    })
  }

  if (
    signals.revenueOperatorEscalation === "critical" ||
    signals.revenueOperatorEscalation === "high" ||
    input.requestKind === "revenue_operator_critical"
  ) {
    return buildDecision({
      interruptOperator: true,
      category: "always_escalate",
      reasonCode: "revenue_operator_escalation",
      constitutionalRef: "E6",
    })
  }

  if (signals.spendingApprovalRequired || input.requestKind === "spending_approval_required") {
    return buildDecision({
      interruptOperator: true,
      category: "operator_approval",
      reasonCode: "spending_approval_required",
      constitutionalRef: "E8",
    })
  }

  if (signals.highStakesRelationship || input.requestKind === "high_stakes_relationship") {
    return buildDecision({
      interruptOperator: true,
      category: "operator_approval",
      reasonCode: "high_stakes_relationship",
      constitutionalRef: "E9",
    })
  }

  if (signals.calibrationProposalReady || input.requestKind === "calibration_apply_ready") {
    return buildDecision({
      interruptOperator: true,
      category: "always_escalate",
      reasonCode: "calibration_apply_ready",
      constitutionalRef: "E10",
    })
  }

  if (input.requestKind === "strategic_direction_change") {
    return buildDecision({
      interruptOperator: true,
      category: "strategic_approval",
      reasonCode: "strategic_direction_change",
      constitutionalRef: "E7",
    })
  }

  if (ALWAYS_ESCALATE.includes(input.requestKind)) {
    return buildDecision({
      interruptOperator: true,
      category: "always_escalate",
      reasonCode: `always_escalate_${input.requestKind}`,
      constitutionalRef: "E1",
    })
  }

  if (NEVER_ESCALATE.includes(input.requestKind)) {
    return buildDecision({
      interruptOperator: false,
      category: "never_escalate",
      reasonCode: `never_escalate_${input.requestKind}`,
      constitutionalRef: "N7",
      accomplishmentOnly: PREPARATION_ACCOMPLISHMENT.includes(input.requestKind),
      suppressionApplied: true,
    })
  }

  if (input.requestKind === "admission_edge_review" || input.requestKind === "research_execution_plan") {
    return buildDecision({
      interruptOperator: false,
      category: "autonomous",
      reasonCode: "conditional_escalation_default_autonomous",
      constitutionalRef: "C1",
      accomplishmentOnly: false,
      suppressionApplied: true,
    })
  }

  if (
    input.requestKind === "request_human_review" ||
    input.requestKind === "generic_operator_review" ||
    input.requestKind === "work_manager_operator_queue" ||
    input.requestKind === "waiting_on_you_item" ||
    input.requestKind === "daily_queue_item"
  ) {
    return buildDecision({
      interruptOperator: false,
      category: "autonomous",
      reasonCode: "subsystem_review_request_suppressed",
      constitutionalRef: "N7",
      suppressionApplied: true,
    })
  }

  return buildDecision({
    interruptOperator: false,
    category: "autonomous",
    reasonCode: "default_autonomous_continue",
    constitutionalRef: "N7",
  })
}

export function resolveSubsystemInterruptAllowed(input: {
  subsystem: string
  requestKind: GrowthCanonicalEscalationRequestKind
  subsystemWouldInterrupt: boolean
  opportunityAuthority?: GrowthCanonicalOpportunityAuthority | null
  signals?: GrowthCanonicalEscalationEvaluationInput["signals"]
}): GrowthCanonicalEscalationDecision {
  const decision = evaluateCanonicalEscalation({
    requestKind: input.requestKind,
    sourceSubsystem: input.subsystem,
    opportunityAuthority: input.opportunityAuthority ?? null,
    signals: input.signals,
  })

  if (input.subsystemWouldInterrupt && !decision.interruptOperator) {
    return {
      ...decision,
      suppressionApplied: true,
      reasonCode: `${decision.reasonCode}:suppressed_${input.subsystem}`,
    }
  }

  return decision
}

export function buildEscalationAgreementSnapshot(input: {
  generatedAt: string
  rows: GrowthEscalationAgreementTelemetryRow[]
}): GrowthEscalationAgreementSnapshot {
  const rows = input.rows
  const samples = rows.length
  const pct = (count: number) => (samples === 0 ? 100 : Math.round((count / samples) * 100))

  const authorityAgreements = rows.filter((row) => row.agreement).length
  const escalationAgreements = rows.filter((row) => row.escalationAgreement).length
  const ownershipAgreements = rows.filter((row) => row.ownershipAgreement).length
  const autonomousExecutions = rows.filter(
    (row) => !row.canonicalInterrupt && !row.subsystemWouldInterrupt,
  ).length
  const unexpectedOverrides = rows.filter(
    (row) => row.subsystemWouldInterrupt && !row.canonicalInterrupt,
  ).length

  return {
    qaMarker: GROWTH_AIOS_GROWTH_OPERATOR_1C_QA_MARKER,
    generatedAt: input.generatedAt,
    samples,
    authorityAgreementPercent: pct(authorityAgreements),
    escalationAgreementPercent: pct(escalationAgreements),
    ownershipAgreementPercent: pct(ownershipAgreements),
    autonomousExecutionPercent: pct(autonomousExecutions),
    unexpectedOverrideCount: unexpectedOverrides,
    rows,
  }
}

export function recordEscalationAgreementRow(input: {
  leadId?: string | null
  subsystem: string
  requestKind: GrowthCanonicalEscalationRequestKind
  subsystemWouldInterrupt: boolean
  opportunityAuthority?: GrowthCanonicalOpportunityAuthority | null
  signals?: GrowthCanonicalEscalationEvaluationInput["signals"]
}): GrowthEscalationAgreementTelemetryRow {
  const decision = resolveSubsystemInterruptAllowed({
    subsystem: input.subsystem,
    requestKind: input.requestKind,
    subsystemWouldInterrupt: input.subsystemWouldInterrupt,
    opportunityAuthority: input.opportunityAuthority,
    signals: input.signals,
  })

  const ownershipAgreement =
    !input.opportunityAuthority ||
    (input.subsystemWouldInterrupt === resolveCanonicalAuthorityRequiresOperator(input.opportunityAuthority))

  return {
    leadId: input.leadId ?? null,
    subsystem: input.subsystem,
    requestKind: input.requestKind,
    subsystemWouldInterrupt: input.subsystemWouldInterrupt,
    canonicalInterrupt: decision.interruptOperator,
    agreement: input.subsystemWouldInterrupt === decision.interruptOperator,
    ownershipAgreement,
    escalationAgreement: input.subsystemWouldInterrupt === decision.interruptOperator,
    reasonCode: decision.reasonCode,
  }
}
