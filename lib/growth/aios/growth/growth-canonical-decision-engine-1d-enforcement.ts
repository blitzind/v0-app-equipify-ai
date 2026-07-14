/**
 * GE-AIOS-DECISION-ENGINE-1D — Operator override metadata + copilot consistency (client-safe evaluators).
 */

import type { GrowthCanonicalDecisionResolution } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import {
  canOperatorOverrideCanonicalSuppression,
  evaluateCanonicalTransportBoundary,
  evaluateGrowth5fPackagePreparation,
  isLeadLifecycleBlockedByDecision,
} from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-enforcement"
import {
  GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1D_QA_MARKER,
  type CanonicalCopilotMaterializationConsistency,
  type CanonicalDecisionOperatorOverrideRecord,
  type CanonicalDecisionOperatorOverrideScope,
} from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1d-types"

export function validateCanonicalDecisionOperatorOverride(input: {
  resolution: GrowthCanonicalDecisionResolution | null
  scope: CanonicalDecisionOperatorOverrideScope
  reason: string | null | undefined
  suppressionCode: string
}): { allowed: boolean; error: string | null } {
  const reason = input.reason?.trim() ?? ""
  if (!reason) {
    return { allowed: false, error: "operator_override_reason_required" }
  }

  if (!input.resolution) {
    return { allowed: false, error: "canonical_decision_unresolved" }
  }

  if (!canOperatorOverrideCanonicalSuppression({ resolution: input.resolution, scope: input.scope })) {
    return { allowed: false, error: "canonical_decision_override_forbidden" }
  }

  return { allowed: true, error: null }
}

export function buildCanonicalDecisionOperatorOverrideRecord(input: {
  operatorId: string
  operatorEmail?: string | null
  reason: string
  resolution: GrowthCanonicalDecisionResolution
  suppressionCode: string
  enforcementFingerprint: string
  scope: CanonicalDecisionOperatorOverrideScope
  recordedAt?: string
}): CanonicalDecisionOperatorOverrideRecord {
  return {
    qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1D_QA_MARKER,
    operatorId: input.operatorId,
    operatorEmail: input.operatorEmail ?? null,
    reason: input.reason.trim(),
    decisionFingerprint: input.resolution.decision.decisionFingerprint,
    suppressionCode: input.suppressionCode,
    enforcementFingerprint: input.enforcementFingerprint,
    scope: input.scope,
    recordedAt: input.recordedAt ?? new Date().toISOString(),
  }
}

export function projectCanonicalDecisionOverrideEssentials(
  override: CanonicalDecisionOperatorOverrideRecord | null | undefined,
): string[] {
  if (!override) return []
  const scopeLabel =
    override.scope === "transport"
      ? "Transport override"
      : override.scope === "sequence"
        ? "Sequence override"
        : "Canonical override"
  return [
    `${scopeLabel}: ${override.reason}`,
    `Suppression code: ${override.suppressionCode}`,
    `Decision fingerprint: ${override.decisionFingerprint}`,
    `Recorded by: ${override.operatorEmail ?? override.operatorId} at ${override.recordedAt}`,
  ]
}

export function evaluateCanonicalCopilotMaterializationConsistency(
  resolution: GrowthCanonicalDecisionResolution | null,
  context: {
    channel?: string | null
    generationType?: string | null
  } = {},
): CanonicalCopilotMaterializationConsistency {
  if (!resolution) {
    return {
      qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1D_QA_MARKER,
      allowedForReview: true,
      blocked: false,
      refreshRequired: false,
      reason: "Canonical decision unavailable — materialization allowed for operator review.",
      outcome: "allowed",
    }
  }

  const channelText = [context.channel, context.generationType].filter(Boolean).join(" ").toLowerCase()
  const nowMs = Date.parse(resolution.generatedAt)

  if (isLeadLifecycleBlockedByDecision(resolution.decision)) {
    return {
      qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1D_QA_MARKER,
      allowedForReview: false,
      blocked: true,
      refreshRequired: false,
      reason: "Lead is no longer eligible — canonical decision blocks materialization.",
      outcome: "blocked",
    }
  }

  if (
    resolution.decision.primaryAction === "wait" &&
    (!resolution.decision.waitUntil || Date.parse(resolution.decision.waitUntil) > nowMs)
  ) {
    return {
      qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1D_QA_MARKER,
      allowedForReview: false,
      blocked: true,
      refreshRequired: false,
      reason: resolution.decision.waitUntil
        ? `Prospect wait until ${resolution.decision.waitUntil} — materialization blocked.`
        : "Canonical wait decision blocks materialization.",
      outcome: "blocked",
    }
  }

  if (
    resolution.freshness.state === "strategy_changed" ||
    resolution.freshness.stalePackageRelativeToDecision
  ) {
    return {
      qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1D_QA_MARKER,
      allowedForReview: true,
      blocked: false,
      refreshRequired: true,
      reason:
        resolution.freshness.state === "strategy_changed"
          ? "Strategy changed — materialization marked refresh-required for operator review."
          : "Package needs refresh — materialization marked refresh-required for operator review.",
      outcome: "refresh_required",
    }
  }

  const transportCheck = evaluateCanonicalTransportBoundary(resolution, {
    humanApproved: true,
    channel: context.channel ?? "email",
  })
  if (!transportCheck.allowed && transportCheck.requiresPackageRefresh) {
    return {
      qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1D_QA_MARKER,
      allowedForReview: true,
      blocked: false,
      refreshRequired: true,
      reason: transportCheck.reason,
      outcome: "refresh_required",
    }
  }

  if (
    !transportCheck.allowed &&
    /cold|discovery|nurture|outreach/i.test(channelText) &&
    resolution.suppressionHints.suppressColdOutreach
  ) {
    return {
      qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1D_QA_MARKER,
      allowedForReview: false,
      blocked: true,
      refreshRequired: false,
      reason: "Canonical decision suppresses cold outreach materialization.",
      outcome: "blocked",
    }
  }

  const packagePrep = evaluateGrowth5fPackagePreparation(resolution, {
    proposedPurpose: resolution.decision.title,
  })
  if (!packagePrep.allowed && packagePrep.outcome === "decision_blocked_lead_lifecycle") {
    return {
      qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1D_QA_MARKER,
      allowedForReview: false,
      blocked: true,
      refreshRequired: false,
      reason: packagePrep.reason,
      outcome: "blocked",
    }
  }

  return {
    qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1D_QA_MARKER,
    allowedForReview: true,
    blocked: false,
    refreshRequired: false,
    reason: "Canonical decision allows materialization for operator review.",
    outcome: "allowed",
  }
}
