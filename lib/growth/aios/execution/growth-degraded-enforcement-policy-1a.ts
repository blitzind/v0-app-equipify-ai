/**
 * GE-AIOS-DEGRADED-ENFORCEMENT-CLOSURE-1A — Degraded decision-resolution policy (client-safe).
 */

import {
  inferHardTerminalReasonFromLeadLifecycle,
  type GrowthCanonicalTerminalReason,
  type GrowthHardTerminalReason,
} from "@/lib/growth/aios/execution/growth-terminal-reason-taxonomy-1a"
import type { GrowthCanonicalLeadLifecycleSnapshot } from "@/lib/growth/aios/execution/growth-canonical-execution-authority-1a"

export const GROWTH_DEGRADED_ENFORCEMENT_POLICY_1A_QA_MARKER =
  "ge-aios-degraded-enforcement-closure-1a-policy-v1" as const

export type GrowthDegradedEnforcementActionKind =
  | "read_only_projection"
  | "passive_information_read"
  | "persisted_safe_research"
  | "qualification_mutation"
  | "contact_discovery"
  | "draft_factory_advancement"
  | "package_preparation"
  | "package_preview"
  | "sequence_preparation"
  | "sequence_dispatch"
  | "transport_dispatch"
  | "terminal_propagation"
  | "memory_audit"
  | "operator_correction"

export type GrowthDegradedEnforcementDisposition =
  | "allowed"
  | "deferred"
  | "blocked"
  | "operator_required"

export type GrowthDegradedEnforcementResult = {
  qaMarker: typeof GROWTH_DEGRADED_ENFORCEMENT_POLICY_1A_QA_MARKER
  disposition: GrowthDegradedEnforcementDisposition
  reasonCode: string
  decisionResolutionFailed: true
  lifecycleEvidenceAvailable: boolean
  terminal: boolean
  retryAppropriate: boolean
  nextSafeRetryAt: string | null
  operatorExplanation: string
  transportBlocked: boolean
  enforcementFingerprint: string
}

/** Definitive degraded-state matrix for certification reporting. */
export const GROWTH_DEGRADED_ENFORCEMENT_POLICY_MATRIX: Record<
  GrowthDegradedEnforcementActionKind,
  GrowthDegradedEnforcementDisposition
> = {
  read_only_projection: "allowed",
  passive_information_read: "allowed",
  persisted_safe_research: "deferred",
  qualification_mutation: "deferred",
  contact_discovery: "deferred",
  draft_factory_advancement: "deferred",
  package_preparation: "deferred",
  package_preview: "allowed",
  sequence_preparation: "deferred",
  sequence_dispatch: "blocked",
  transport_dispatch: "blocked",
  terminal_propagation: "allowed",
  memory_audit: "allowed",
  operator_correction: "allowed",
}

const DEGRADED_RETRY_BACKOFF_MS = 5 * 60 * 1000

export function computeDegradedRetryWakeAt(nowMs: number = Date.now()): string {
  return new Date(nowMs + DEGRADED_RETRY_BACKOFF_MS).toISOString()
}

function hasLifecycleEvidence(lifecycle?: GrowthCanonicalLeadLifecycleSnapshot): boolean {
  if (!lifecycle) return false
  return Boolean(
    lifecycle.status ||
      lifecycle.archivedAt ||
      lifecycle.admissionState ||
      lifecycle.suppressed ||
      lifecycle.opportunityStage,
  )
}

function buildDegradedResult(input: {
  disposition: GrowthDegradedEnforcementDisposition
  reasonCode: string
  lifecycle?: GrowthCanonicalLeadLifecycleSnapshot
  terminal?: boolean
  retryAppropriate?: boolean
  nextSafeRetryAt?: string | null
  operatorExplanation: string
  transportBlocked?: boolean
}): GrowthDegradedEnforcementResult {
  const lifecycleEvidenceAvailable = hasLifecycleEvidence(input.lifecycle)
  const retryAppropriate =
    input.retryAppropriate ?? (input.disposition === "deferred" && !input.terminal)
  return {
    qaMarker: GROWTH_DEGRADED_ENFORCEMENT_POLICY_1A_QA_MARKER,
    disposition: input.disposition,
    reasonCode: input.reasonCode,
    decisionResolutionFailed: true,
    lifecycleEvidenceAvailable,
    terminal: input.terminal === true,
    retryAppropriate,
    nextSafeRetryAt:
      input.nextSafeRetryAt ?? (retryAppropriate ? computeDegradedRetryWakeAt() : null),
    operatorExplanation: input.operatorExplanation,
    transportBlocked: input.transportBlocked ?? input.disposition !== "allowed",
    enforcementFingerprint: `degraded:${input.reasonCode}:${input.disposition}`,
  }
}

export function evaluateDegradedCanonicalEnforcement(input: {
  actionKind: GrowthDegradedEnforcementActionKind
  leadLifecycle?: GrowthCanonicalLeadLifecycleSnapshot
  explicitOperatorRequest?: boolean
  generatedAt?: string
}): GrowthDegradedEnforcementResult {
  const hardTerminal = inferHardTerminalReasonFromLeadLifecycle(input.leadLifecycle ?? {})
  const lifecycle = input.leadLifecycle

  if (hardTerminal) {
    return buildDegradedResult({
      disposition: "blocked",
      reasonCode: `hard_terminal_${hardTerminal}`,
      lifecycle,
      terminal: true,
      retryAppropriate: false,
      operatorExplanation: formatDegradedEnforcementOperatorMessage("hard_terminal", hardTerminal),
      transportBlocked: true,
    })
  }

  if (lifecycle?.suppressed) {
    return buildDegradedResult({
      disposition: "blocked",
      reasonCode: "suppression_active",
      lifecycle,
      terminal: true,
      retryAppropriate: false,
      operatorExplanation: formatDegradedEnforcementOperatorMessage("suppression"),
      transportBlocked: true,
    })
  }

  if (input.actionKind === "terminal_propagation" || input.actionKind === "memory_audit") {
    return buildDegradedResult({
      disposition: "allowed",
      reasonCode: "terminal_or_audit_allowed_without_decision",
      lifecycle,
      operatorExplanation: formatDegradedEnforcementOperatorMessage("audit_allowed"),
      transportBlocked: false,
    })
  }

  if (
    input.actionKind === "read_only_projection" ||
    input.actionKind === "passive_information_read" ||
    input.actionKind === "operator_correction"
  ) {
    return buildDegradedResult({
      disposition: "allowed",
      reasonCode: "read_only_degraded_allowed",
      lifecycle,
      operatorExplanation: formatDegradedEnforcementOperatorMessage("read_only"),
      transportBlocked: false,
    })
  }

  if (input.actionKind === "package_preview") {
    return buildDegradedResult({
      disposition: "allowed",
      reasonCode: "preview_only_transport_blocked",
      lifecycle,
      operatorExplanation: formatDegradedEnforcementOperatorMessage("preview_only"),
      transportBlocked: true,
    })
  }

  if (
    input.actionKind === "persisted_safe_research" &&
    input.explicitOperatorRequest
  ) {
    return buildDegradedResult({
      disposition: "allowed",
      reasonCode: "safe_research_operator_request",
      lifecycle,
      operatorExplanation: formatDegradedEnforcementOperatorMessage("operator_request"),
      transportBlocked: true,
    })
  }

  const matrixDisposition = GROWTH_DEGRADED_ENFORCEMENT_POLICY_MATRIX[input.actionKind]
  const explanationKey =
    matrixDisposition === "deferred"
      ? "deferred"
      : matrixDisposition === "blocked"
        ? "blocked"
        : "allowed"

  return buildDegradedResult({
    disposition: matrixDisposition,
    reasonCode: `decision_unavailable_${input.actionKind}`,
    lifecycle,
    retryAppropriate: matrixDisposition === "deferred",
    operatorExplanation: formatDegradedEnforcementOperatorMessage(explanationKey),
    transportBlocked: matrixDisposition !== "allowed",
  })
}

export function formatDegradedEnforcementOperatorMessage(
  kind:
    | "deferred"
    | "blocked"
    | "read_only"
    | "preview_only"
    | "operator_request"
    | "audit_allowed"
    | "hard_terminal"
    | "suppression",
  terminalReason?: GrowthCanonicalTerminalReason | GrowthHardTerminalReason | null,
): string {
  switch (kind) {
    case "deferred":
      return "Ava could not confirm the current next step, so this work has been paused for review."
    case "blocked":
      return "The account state could not be verified. No new outreach was prepared."
    case "preview_only":
      return "This package remains available for review, but it cannot be sent until the account decision is refreshed."
    case "read_only":
      return "Ava is showing the latest available information while account status is being confirmed."
    case "operator_request":
      return "Ava is completing your requested review while the account decision refreshes."
    case "audit_allowed":
      return "History and audit records remain available."
    case "suppression":
      return "This account is suppressed. No further outreach will be sent."
    case "hard_terminal":
      if (terminalReason === "archived") {
        return "This account has been archived. Ava stopped all autonomous work."
      }
      if (terminalReason === "unsubscribed") {
        return "The prospect unsubscribed. No further outreach will be sent."
      }
      return "This account is no longer eligible for autonomous work."
    default:
      return "Ava paused this work until the account status can be confirmed."
  }
}

export const GROWTH_DRAFT_FACTORY_RECOVERABLE_FAILURE_CODES = [
  "postgres_unavailable",
  "decision_resolver_unavailable",
  "provider_timeout",
  "transient_db_failure",
  "configuration_dependency",
  "decision_deferred_resolution_unavailable",
] as const

export const GROWTH_DRAFT_FACTORY_NON_RECOVERABLE_FAILURE_CODES = [
  "invalid",
  "rejected",
  "duplicate",
  "admission_blocked",
  "compliance_suppressed",
  "hard_terminal",
  "lead_archived",
  "lead_disqualified",
] as const

export function classifyDraftFactoryFailureRecoverability(input: {
  errorCode?: string | null
  pausedReason?: string | null
  leadLifecycle?: GrowthCanonicalLeadLifecycleSnapshot
}): "recoverable" | "non_recoverable" {
  const hardTerminal = inferHardTerminalReasonFromLeadLifecycle(input.leadLifecycle ?? {})
  if (hardTerminal || input.leadLifecycle?.suppressed) return "non_recoverable"

  const code = (input.errorCode ?? input.pausedReason ?? "").trim().toLowerCase()
  if (
    (GROWTH_DRAFT_FACTORY_NON_RECOVERABLE_FAILURE_CODES as readonly string[]).some((row) =>
      code.includes(row),
    )
  ) {
    return "non_recoverable"
  }
  if (
    (GROWTH_DRAFT_FACTORY_RECOVERABLE_FAILURE_CODES as readonly string[]).some((row) =>
      code.includes(row),
    )
  ) {
    return "recoverable"
  }
  return "recoverable"
}

export function isDegradedEnforcementAllowed(result: GrowthDegradedEnforcementResult): boolean {
  return result.disposition === "allowed"
}
