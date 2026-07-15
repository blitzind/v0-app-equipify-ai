/**
 * GE-AIOS-EXECUTION-AUTHORITY-CLOSURE-1A — Canonical execution authority gate (client-safe).
 *
 * Reuses Decision Engine 1C conclusions — does not reproduce decision logic.
 */

import type { GrowthCanonicalDecisionResolution } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import type { GrowthCanonicalNextBestDecision } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-types"
import {
  evaluateGrowth5fPackagePreparation,
  isLeadLifecycleBlockedByDecision,
  isRelationshipProtectionPause,
} from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-enforcement"
import {
  GROWTH_CANONICAL_EXECUTION_AUTHORITY_ACTION_POLICY_1A_QA_MARKER,
  resolveExecutionActionPolicy,
  type GrowthCanonicalExecutionActionKind,
} from "@/lib/growth/aios/execution/growth-canonical-execution-authority-action-policy-1a"
import {
  inferHardTerminalReasonFromLeadLifecycle,
  type GrowthCanonicalTerminalReason,
  type GrowthHardTerminalReason,
} from "@/lib/growth/aios/execution/growth-terminal-reason-taxonomy-1a"

export const GROWTH_CANONICAL_EXECUTION_AUTHORITY_1A_QA_MARKER =
  "ge-aios-execution-authority-closure-1a-authority-gate-v1" as const

export { GROWTH_CANONICAL_EXECUTION_AUTHORITY_ACTION_POLICY_1A_QA_MARKER }

export type GrowthCanonicalExecutionAuthorityDisposition =
  | "allowed"
  | "deferred"
  | "blocked"
  | "operator_required"

export type GrowthCanonicalLeadLifecycleSnapshot = {
  status?: string | null
  archivedAt?: string | null
  admissionState?: string | null
  suppressed?: boolean
  suppressionReason?: string | null
  opportunityStage?: string | null
  expansionWorkflowActive?: boolean
}

export type GrowthCanonicalExecutionAuthorityInput = {
  actionKind: GrowthCanonicalExecutionActionKind
  resolution: GrowthCanonicalDecisionResolution | null
  leadLifecycle: GrowthCanonicalLeadLifecycleSnapshot
  explicitOperatorRequest?: boolean
  generatedAt?: string
}

export type GrowthCanonicalExecutionAuthorityResult = {
  qaMarker: typeof GROWTH_CANONICAL_EXECUTION_AUTHORITY_1A_QA_MARKER
  disposition: GrowthCanonicalExecutionAuthorityDisposition
  reasonCode: string
  decisionFingerprint: string | null
  lifecycleReason: GrowthCanonicalTerminalReason | GrowthHardTerminalReason | null
  waitUntil: string | null
  nextEligibleWakeAt: string | null
  terminal: boolean
  informationOnly: boolean
  enforcementFingerprint: string | null
}

function isWaitActive(decision: GrowthCanonicalNextBestDecision, nowMs: number): boolean {
  if (decision.primaryAction !== "wait") return false
  if (!decision.waitUntil) return true
  return Date.parse(decision.waitUntil) > nowMs
}

function isOperatorPause(decision: GrowthCanonicalNextBestDecision): boolean {
  return (
    decision.primaryAction === "pause" ||
    decision.blockedBy.some(
      (row) => row.source === "operator_constraints" && /pause|operator/i.test(row.label),
    )
  )
}

function buildResult(input: {
  disposition: GrowthCanonicalExecutionAuthorityDisposition
  reasonCode: string
  decisionFingerprint?: string | null
  lifecycleReason?: GrowthCanonicalTerminalReason | GrowthHardTerminalReason | null
  waitUntil?: string | null
  nextEligibleWakeAt?: string | null
  terminal?: boolean
  informationOnly?: boolean
  enforcementFingerprint?: string | null
}): GrowthCanonicalExecutionAuthorityResult {
  return {
    qaMarker: GROWTH_CANONICAL_EXECUTION_AUTHORITY_1A_QA_MARKER,
    disposition: input.disposition,
    reasonCode: input.reasonCode,
    decisionFingerprint: input.decisionFingerprint ?? null,
    lifecycleReason: input.lifecycleReason ?? null,
    waitUntil: input.waitUntil ?? null,
    nextEligibleWakeAt: input.nextEligibleWakeAt ?? input.waitUntil ?? null,
    terminal: input.terminal === true,
    informationOnly: input.informationOnly === true,
    enforcementFingerprint: input.enforcementFingerprint ?? null,
  }
}

export function evaluateCanonicalExecutionAuthority(
  input: GrowthCanonicalExecutionAuthorityInput,
): GrowthCanonicalExecutionAuthorityResult {
  const policy = resolveExecutionActionPolicy(input.actionKind)
  const hardTerminal = inferHardTerminalReasonFromLeadLifecycle(input.leadLifecycle)

  if (input.actionKind === "terminal_propagation" || input.actionKind === "contact_terminal_propagation") {
    return buildResult({
      disposition: "allowed",
      reasonCode: "terminal_propagation_always_allowed",
      lifecycleReason: hardTerminal,
      informationOnly: false,
    })
  }

  if (policy.informationOnly || input.actionKind === "read_only_projection" || input.actionKind === "passive_research_read") {
    return buildResult({
      disposition: "allowed",
      reasonCode: "information_only_allowed",
      lifecycleReason: hardTerminal,
      informationOnly: true,
    })
  }

  if (hardTerminal) {
    if (policy.allowedAfterHardTerminal || input.explicitOperatorRequest) {
      return buildResult({
        disposition: "allowed",
        reasonCode: "hard_terminal_operator_override",
        lifecycleReason: hardTerminal,
        terminal: true,
      })
    }
    return buildResult({
      disposition: "blocked",
      reasonCode: `hard_terminal_${hardTerminal}`,
      lifecycleReason: hardTerminal,
      terminal: true,
    })
  }

  const resolution = input.resolution
  const nowMs = Date.parse(input.generatedAt ?? resolution?.generatedAt ?? new Date().toISOString())

  if (!resolution) {
    if (policy.actionClass === "read_only") {
      return buildResult({ disposition: "allowed", reasonCode: "degraded_read_only_allowed", informationOnly: true })
    }
    if (policy.actionClass === "safe_research" && input.explicitOperatorRequest) {
      return buildResult({ disposition: "allowed", reasonCode: "degraded_safe_research_operator_request" })
    }
    if (policy.actionClass === "safe_research") {
      return buildResult({ disposition: "deferred", reasonCode: "degraded_safe_research_deferred" })
    }
    if (policy.actionClass === "internal_mutation") {
      return buildResult({ disposition: "deferred", reasonCode: "degraded_internal_mutation_deferred" })
    }
    return buildResult({ disposition: "blocked", reasonCode: "degraded_customer_facing_blocked", terminal: false })
  }

  const { decision } = resolution
  const fingerprint = decision.decisionFingerprint

  if (isLeadLifecycleBlockedByDecision(decision) && !input.explicitOperatorRequest) {
    return buildResult({
      disposition: "blocked",
      reasonCode: "decision_lifecycle_blocked",
      decisionFingerprint: fingerprint,
      lifecycleReason: hardTerminal,
      terminal: true,
      enforcementFingerprint: resolution.suppressionHints.suppressTransport ? "lifecycle:blocked" : null,
    })
  }

  const waitActive = isWaitActive(decision, nowMs)
  const operatorPaused = isOperatorPause(decision)
  const relationshipProtection = isRelationshipProtectionPause(decision)

  if (waitActive && !policy.allowedDuringProspectWait && !input.explicitOperatorRequest) {
    return buildResult({
      disposition: "deferred",
      reasonCode: "prospect_wait_active",
      decisionFingerprint: fingerprint,
      lifecycleReason: "prospect_wait",
      waitUntil: decision.waitUntil ?? null,
      nextEligibleWakeAt: decision.waitUntil ?? null,
    })
  }

  if ((operatorPaused || relationshipProtection) && !policy.allowedDuringOperatorPause && !input.explicitOperatorRequest) {
    return buildResult({
      disposition: "deferred",
      reasonCode: operatorPaused ? "operator_pause_active" : "relationship_protection_active",
      decisionFingerprint: fingerprint,
      lifecycleReason: operatorPaused ? "operator_paused" : "relationship_protection",
    })
  }

  if (policy.requires1CEnforcement) {
    const isSafeResearchDuringWait =
      policy.actionClass === "safe_research" &&
      waitActive &&
      policy.allowedDuringProspectWait &&
      !input.explicitOperatorRequest

    if (!isSafeResearchDuringWait) {
      const enforcement = evaluateGrowth5fPackagePreparation(resolution, {
        proposedPurpose:
          input.actionKind === "qualification_mutation"
            ? "qualification"
            : input.actionKind === "contact_discovery"
              ? "contact discovery"
              : input.actionKind === "contact_verification"
                ? "contact verification"
                : input.actionKind === "persisted_research_run"
                  ? "research readiness"
                  : "internal mutation",
        isOperatorRebuild: input.explicitOperatorRequest === true,
      })

      if (!enforcement.allowed) {
        const deferredOutcomes = new Set([
          "decision_blocked_waiting_on_prospect",
          "decision_blocked_relationship_protection",
          "decision_blocked_waiting_on_operator",
          "decision_refresh_required",
        ])
        return buildResult({
          disposition: deferredOutcomes.has(enforcement.outcome) ? "deferred" : "blocked",
          reasonCode: enforcement.outcome,
          decisionFingerprint: fingerprint,
          waitUntil: enforcement.waitUntil ?? null,
          nextEligibleWakeAt: enforcement.nextEligibleWakeAt ?? null,
          enforcementFingerprint: enforcement.enforcementFingerprint,
          lifecycleReason:
            enforcement.outcome === "decision_blocked_waiting_on_prospect"
              ? "prospect_wait"
              : enforcement.outcome === "decision_blocked_relationship_protection"
                ? "relationship_protection"
                : null,
        })
      }
    }
  }

  if (policy.actionClass === "customer_facing") {
    return buildResult({
      disposition: policy.requiresApproval ? "operator_required" : "blocked",
      reasonCode: "customer_facing_requires_operator",
      decisionFingerprint: fingerprint,
    })
  }

  return buildResult({
    disposition: "allowed",
    reasonCode: "canonical_authority_allowed",
    decisionFingerprint: fingerprint,
    enforcementFingerprint: resolution.suppressionHints.suppressColdOutreach ? "allowed:guarded" : null,
  })
}

export function isCanonicalExecutionAllowed(
  result: GrowthCanonicalExecutionAuthorityResult,
): boolean {
  return result.disposition === "allowed"
}
