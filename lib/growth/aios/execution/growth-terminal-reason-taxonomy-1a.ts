/**
 * GE-AIOS-EXECUTION-AUTHORITY-CLOSURE-1A — Canonical terminal reason taxonomy (client-safe).
 */

export const GROWTH_TERMINAL_REASON_TAXONOMY_1A_QA_MARKER =
  "ge-aios-execution-authority-closure-1a-terminal-taxonomy-v1" as const

/** Hard terminal — autonomous advancement must stop until explicit reopen. */
export const GROWTH_HARD_TERMINAL_REASONS = [
  "unsubscribed",
  "compliance_suppressed",
  "archived",
  "disqualified",
  "invalid",
  "duplicate",
  "company_closed",
  "closed_won",
  "closed_lost",
  "converted_customer",
] as const

/** Resumable — work pauses but may resume when condition clears. */
export const GROWTH_RESUMABLE_STOP_REASONS = [
  "operator_paused",
  "prospect_wait",
  "relationship_protection",
  "provider_budget_wait",
] as const

export type GrowthHardTerminalReason = (typeof GROWTH_HARD_TERMINAL_REASONS)[number]
export type GrowthResumableStopReason = (typeof GROWTH_RESUMABLE_STOP_REASONS)[number]
export type GrowthCanonicalTerminalReason = GrowthHardTerminalReason | GrowthResumableStopReason

/** Legacy stop reasons mapped into the canonical taxonomy. */
export type GrowthLegacyStopAutonomousWorkReason =
  | "operator_canceled"
  | "lead_archived"
  | "lead_disqualified"
  | "operator_permanent_delete"

export type GrowthTerminalReasonPolicy = {
  reason: GrowthCanonicalTerminalReason
  hardTerminal: boolean
  researchAllowed: boolean
  sequencesAction: "cancel" | "pause" | "none"
  draftFactoryAction: "terminate" | "pause" | "none"
  retainFutureWake: boolean
  operatorResumePossible: boolean
}

const HARD_TERMINAL_POLICIES: Record<GrowthHardTerminalReason, GrowthTerminalReasonPolicy> = {
  unsubscribed: {
    reason: "unsubscribed",
    hardTerminal: true,
    researchAllowed: false,
    sequencesAction: "cancel",
    draftFactoryAction: "terminate",
    retainFutureWake: false,
    operatorResumePossible: false,
  },
  compliance_suppressed: {
    reason: "compliance_suppressed",
    hardTerminal: true,
    researchAllowed: false,
    sequencesAction: "cancel",
    draftFactoryAction: "terminate",
    retainFutureWake: false,
    operatorResumePossible: false,
  },
  archived: {
    reason: "archived",
    hardTerminal: true,
    researchAllowed: false,
    sequencesAction: "cancel",
    draftFactoryAction: "terminate",
    retainFutureWake: false,
    operatorResumePossible: true,
  },
  disqualified: {
    reason: "disqualified",
    hardTerminal: true,
    researchAllowed: false,
    sequencesAction: "cancel",
    draftFactoryAction: "terminate",
    retainFutureWake: false,
    operatorResumePossible: true,
  },
  invalid: {
    reason: "invalid",
    hardTerminal: true,
    researchAllowed: false,
    sequencesAction: "cancel",
    draftFactoryAction: "terminate",
    retainFutureWake: false,
    operatorResumePossible: false,
  },
  duplicate: {
    reason: "duplicate",
    hardTerminal: true,
    researchAllowed: false,
    sequencesAction: "cancel",
    draftFactoryAction: "terminate",
    retainFutureWake: false,
    operatorResumePossible: false,
  },
  company_closed: {
    reason: "company_closed",
    hardTerminal: true,
    researchAllowed: false,
    sequencesAction: "cancel",
    draftFactoryAction: "terminate",
    retainFutureWake: false,
    operatorResumePossible: false,
  },
  closed_won: {
    reason: "closed_won",
    hardTerminal: true,
    researchAllowed: false,
    sequencesAction: "cancel",
    draftFactoryAction: "terminate",
    retainFutureWake: false,
    operatorResumePossible: true,
  },
  closed_lost: {
    reason: "closed_lost",
    hardTerminal: true,
    researchAllowed: false,
    sequencesAction: "cancel",
    draftFactoryAction: "terminate",
    retainFutureWake: false,
    operatorResumePossible: true,
  },
  converted_customer: {
    reason: "converted_customer",
    hardTerminal: true,
    researchAllowed: false,
    sequencesAction: "cancel",
    draftFactoryAction: "terminate",
    retainFutureWake: false,
    operatorResumePossible: true,
  },
}

const RESUMABLE_POLICIES: Record<GrowthResumableStopReason, GrowthTerminalReasonPolicy> = {
  operator_paused: {
    reason: "operator_paused",
    hardTerminal: false,
    researchAllowed: false,
    sequencesAction: "pause",
    draftFactoryAction: "pause",
    retainFutureWake: false,
    operatorResumePossible: true,
  },
  prospect_wait: {
    reason: "prospect_wait",
    hardTerminal: false,
    researchAllowed: true,
    sequencesAction: "pause",
    draftFactoryAction: "pause",
    retainFutureWake: true,
    operatorResumePossible: false,
  },
  relationship_protection: {
    reason: "relationship_protection",
    hardTerminal: false,
    researchAllowed: false,
    sequencesAction: "pause",
    draftFactoryAction: "pause",
    retainFutureWake: false,
    operatorResumePossible: true,
  },
  provider_budget_wait: {
    reason: "provider_budget_wait",
    hardTerminal: false,
    researchAllowed: false,
    sequencesAction: "pause",
    draftFactoryAction: "pause",
    retainFutureWake: true,
    operatorResumePossible: false,
  },
}

export function isHardTerminalReason(
  reason: GrowthCanonicalTerminalReason,
): reason is GrowthHardTerminalReason {
  return (GROWTH_HARD_TERMINAL_REASONS as readonly string[]).includes(reason)
}

export function getTerminalReasonPolicy(
  reason: GrowthCanonicalTerminalReason,
): GrowthTerminalReasonPolicy {
  if (isHardTerminalReason(reason)) {
    return HARD_TERMINAL_POLICIES[reason]
  }
  return RESUMABLE_POLICIES[reason]
}

export function mapLegacyStopReasonToCanonical(
  reason: GrowthLegacyStopAutonomousWorkReason,
): GrowthCanonicalTerminalReason {
  switch (reason) {
    case "lead_archived":
      return "archived"
    case "lead_disqualified":
      return "disqualified"
    case "operator_canceled":
      return "operator_paused"
    case "operator_permanent_delete":
      return "archived"
    default:
      return "operator_paused"
  }
}

export function inferHardTerminalReasonFromLeadLifecycle(input: {
  status?: string | null
  archivedAt?: string | null
  admissionState?: string | null
  suppressed?: boolean
  suppressionReason?: string | null
  opportunityStage?: string | null
  expansionWorkflowActive?: boolean
}): GrowthHardTerminalReason | null {
  const status = input.status?.trim().toLowerCase() ?? ""
  const admission = input.admissionState?.trim().toLowerCase() ?? ""

  if (input.archivedAt || status === "archived") return "archived"
  if (status === "disqualified") return "disqualified"
  if (status === "converted" && !input.expansionWorkflowActive) return "converted_customer"
  if (admission === "invalid" || admission === "rejected") return "invalid"
  if (admission === "duplicate") return "duplicate"
  if (admission === "company_closed") return "company_closed"

  if (input.suppressed) {
    const reason = input.suppressionReason?.toLowerCase() ?? ""
    if (reason.includes("unsub")) return "unsubscribed"
    return "compliance_suppressed"
  }

  const stage = input.opportunityStage?.trim().toLowerCase() ?? ""
  if (stage === "closed_won") return "closed_won"
  if (stage === "closed_lost") return "closed_lost"

  return null
}

export function formatTerminalReasonOperatorMessage(reason: GrowthCanonicalTerminalReason): string {
  switch (reason) {
    case "archived":
      return "This account has been archived. Ava stopped all autonomous work."
    case "unsubscribed":
      return "The prospect unsubscribed. No further outreach will be sent."
    case "compliance_suppressed":
      return "This account is compliance suppressed. Ava stopped all autonomous outreach."
    case "disqualified":
      return "This account was disqualified. Ava stopped active sales work."
    case "invalid":
      return "This account is not eligible for autonomous work."
    case "duplicate":
      return "This account is a duplicate. Ava stopped autonomous advancement."
    case "company_closed":
      return "This company is closed. Ava stopped all autonomous work."
    case "closed_won":
      return "The opportunity was closed won. Ava stopped cold outreach and preserved the history."
    case "closed_lost":
      return "The opportunity was closed lost. Ava stopped active sales work and preserved the history."
    case "converted_customer":
      return "This account converted to a customer. Ava stopped cold sales work."
    case "operator_paused":
      return "You paused this account. Ava will not resume until you choose to."
    case "prospect_wait":
      return "Work is paused until the agreed follow-up date."
    case "relationship_protection":
      return "Ava paused outreach to protect the relationship."
    case "provider_budget_wait":
      return "Ava paused provider work until budget is available again."
    default:
      return "Ava stopped autonomous work on this account."
  }
}
