/**
 * GE-AIOS-DECISION-ENGINE-1C — Runtime canonical decision enforcement (client-safe).
 */

import type { GrowthCanonicalDecisionResolution } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import type { GrowthCanonicalNextBestDecision } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-types"
import {
  GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1C_QA_MARKER,
  type GrowthCanonicalDraftFactoryDecisionGate,
  type GrowthCanonicalHacEnforcementProjection,
  type GrowthCanonicalHacEnforcementStatus,
  type GrowthCanonicalPackagePreparationContext,
  type GrowthCanonicalPackagePreparationEnforcement,
  type GrowthCanonicalPackagePreparationOutcome,
  type GrowthCanonicalSequenceStepEnforcement,
  type GrowthCanonicalSequenceSuppressionOutcome,
  type GrowthCanonicalTransportBoundaryEnforcement,
  type GrowthCanonicalTransportBoundaryOutcome,
} from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-types"

function joinLower(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" ").toLowerCase()
}

export function buildCanonicalEnforcementFingerprint(input: {
  decisionFingerprint: string
  outcome: string
  scope?: string | null
}): string {
  return [input.decisionFingerprint, input.scope ?? "runtime", input.outcome].join(":")
}

function isWaitActive(decision: GrowthCanonicalNextBestDecision, nowMs: number): boolean {
  if (decision.primaryAction !== "wait") return false
  if (!decision.waitUntil) return true
  return Date.parse(decision.waitUntil) > nowMs
}

export function isLeadLifecycleBlockedByDecision(decision: GrowthCanonicalNextBestDecision): boolean {
  if (decision.primaryAction === "no_action" || decision.primaryAction === "disqualify") {
    return true
  }
  return decision.blockedBy.some(
    (row) => row.source === "operator_constraints" && row.severity === "hard",
  )
}

export function isRelationshipProtectionPause(decision: GrowthCanonicalNextBestDecision): boolean {
  return (
    decision.primaryAction === "pause" ||
    decision.blockedBy.some((row) => /relationship|trust|protection/i.test(row.label))
  )
}

export function isPackageRequiredByPrimaryAction(
  decision: GrowthCanonicalNextBestDecision,
  context: GrowthCanonicalPackagePreparationContext,
): boolean {
  const purpose = joinLower([context.proposedPurpose, context.wakeCondition])
  const action = decision.primaryAction

  if (action === "send_promised_information") {
    return /checklist|promised|workflow|information|follow-up|follow up|commitment/.test(purpose)
  }
  if (action === "prepare_meeting") {
    return /meeting|prep|workflow review|stakeholder/.test(purpose)
  }
  if (action === "reply") {
    return /reply|response|inbound/.test(purpose)
  }
  if (action === "schedule_meeting") {
    return /meeting|calendar|schedule/.test(purpose)
  }
  if (action === "contact" && !decision.transportBlocked) {
    return /outreach|introduction|cold|contact/.test(purpose)
  }
  return false
}

export function isSupportingDecisionPackage(
  decision: GrowthCanonicalNextBestDecision,
  context: GrowthCanonicalPackagePreparationContext,
): boolean {
  const purpose = joinLower([context.proposedPurpose])
  return decision.supportingActions.some((row) => {
    if (row.action === "prepare_meeting") return /meeting|prep/.test(purpose)
    if (row.action === "send_promised_information") return /checklist|promised|workflow/.test(purpose)
    return false
  })
}

function packagePreparationResult(input: {
  allowed: boolean
  outcome: GrowthCanonicalPackagePreparationOutcome
  reason: string
  decisionFingerprint: string
  waitUntil?: string | null
  nextEligibleWakeAt?: string | null
}): GrowthCanonicalPackagePreparationEnforcement {
  const waitUntil = input.waitUntil ?? null
  return {
    qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1C_QA_MARKER,
    allowed: input.allowed,
    outcome: input.outcome,
    reason: input.reason,
    waitUntil,
    nextEligibleWakeAt: input.nextEligibleWakeAt ?? waitUntil,
    enforcementFingerprint: buildCanonicalEnforcementFingerprint({
      decisionFingerprint: input.decisionFingerprint,
      outcome: input.outcome,
      scope: "growth5f",
    }),
  }
}

export function evaluateGrowth5fPackagePreparation(
  resolution: GrowthCanonicalDecisionResolution | null,
  context: GrowthCanonicalPackagePreparationContext = {},
): GrowthCanonicalPackagePreparationEnforcement {
  if (!resolution) {
    return packagePreparationResult({
      allowed: true,
      outcome: "decision_allowed",
      reason: "Canonical decision unavailable — fail open for package preparation.",
      decisionFingerprint: "unresolved",
    })
  }

  const { decision, freshness, suppressionHints } = resolution
  const fingerprint = decision.decisionFingerprint
  const nowMs = Date.parse(resolution.generatedAt)
  const requiredByDecision =
    isPackageRequiredByPrimaryAction(decision, context) ||
    isSupportingDecisionPackage(decision, context)
  const materialRefresh =
    context.isMaterialRefresh === true ||
    context.wakeCondition === "relationship_material_change"
  const operatorRebuild = context.isOperatorRebuild === true

  if (isLeadLifecycleBlockedByDecision(decision) && !operatorRebuild) {
    return packagePreparationResult({
      allowed: false,
      outcome: "decision_blocked_lead_lifecycle",
      reason: "Lead is archived, disqualified, suppressed, or unsubscribed.",
      decisionFingerprint: fingerprint,
    })
  }

  if (isWaitActive(decision, nowMs) && !materialRefresh && !operatorRebuild && !requiredByDecision) {
    return packagePreparationResult({
      allowed: false,
      outcome: "decision_blocked_waiting_on_prospect",
      reason: decision.waitUntil
        ? `Prospect requested wait until ${decision.waitUntil}.`
        : "Canonical decision is wait — defer competing package preparation.",
      decisionFingerprint: fingerprint,
      waitUntil: decision.waitUntil ?? null,
    })
  }

  if (isRelationshipProtectionPause(decision) && !requiredByDecision && !materialRefresh) {
    return packagePreparationResult({
      allowed: false,
      outcome: "decision_blocked_relationship_protection",
      reason: "Relationship protection requires a pause before new outreach packages.",
      decisionFingerprint: fingerprint,
    })
  }

  if (
    suppressionHints.suppressDuplicatePackage &&
    !requiredByDecision &&
    !materialRefresh &&
    !operatorRebuild
  ) {
    return packagePreparationResult({
      allowed: false,
      outcome: "decision_blocked_waiting_on_operator",
      reason: "Another package is pending operator approval.",
      decisionFingerprint: fingerprint,
    })
  }

  if (
    !requiredByDecision &&
    !materialRefresh &&
    !operatorRebuild &&
    suppressionHints.suppressColdOutreach &&
    (isColdOutreachPurpose(context) || decision.primaryAction !== "contact")
  ) {
    return packagePreparationResult({
      allowed: false,
      outcome: "decision_blocked_competing_package",
      reason: isColdOutreachPurpose(context)
        ? "Cold outreach is suppressed by the canonical decision."
        : "Proposed package conflicts with the current canonical primary action.",
      decisionFingerprint: fingerprint,
    })
  }

  if (
    freshness.stalePackageRelativeToDecision &&
    !materialRefresh &&
    !operatorRebuild &&
    !requiredByDecision
  ) {
    return packagePreparationResult({
      allowed: false,
      outcome: "decision_refresh_required",
      reason:
        freshness.state === "strategy_changed"
          ? "Strategy changed — refresh package before preparing a new competing package."
          : "A newer material event makes the requested package stale.",
      decisionFingerprint: fingerprint,
    })
  }

  return packagePreparationResult({
    allowed: true,
    outcome: "decision_allowed",
    reason: requiredByDecision
      ? "Package directly required by the canonical primary or supporting action."
      : materialRefresh
        ? "Package refresh explicitly required by a newer material event."
        : operatorRebuild
          ? "Operator-requested rebuild passed canonical authority checks."
          : "Canonical decision allows package preparation.",
    decisionFingerprint: fingerprint,
  })
}

function isColdOutreachPurpose(context: GrowthCanonicalPackagePreparationContext): boolean {
  const purpose = joinLower([context.proposedPurpose, context.wakeCondition])
  return /cold|discovery|nurture|introduction|first touch|outreach/.test(purpose)
}

export function evaluateDraftFactoryDecisionGate(
  resolution: GrowthCanonicalDecisionResolution | null,
  context: GrowthCanonicalPackagePreparationContext = {},
): GrowthCanonicalDraftFactoryDecisionGate {
  const enforcement = evaluateGrowth5fPackagePreparation(resolution, context)
  return {
    qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1C_QA_MARKER,
    allowGeneration: enforcement.allowed,
    outcome: enforcement.outcome,
    reason: enforcement.reason,
    waitUntil: enforcement.waitUntil,
    nextEligibleWakeAt: enforcement.nextEligibleWakeAt,
    enforcementFingerprint: enforcement.enforcementFingerprint,
  }
}

function sequenceResult(input: {
  allowed: boolean
  outcome: GrowthCanonicalSequenceSuppressionOutcome
  reason: string
  decisionFingerprint: string
  waitUntil?: string | null
  isColdOutreachStep?: boolean
}): GrowthCanonicalSequenceStepEnforcement {
  return {
    qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1C_QA_MARKER,
    allowed: input.allowed,
    outcome: input.outcome,
    reason: input.reason,
    waitUntil: input.waitUntil ?? null,
    isColdOutreachStep: input.isColdOutreachStep,
    enforcementFingerprint: buildCanonicalEnforcementFingerprint({
      decisionFingerprint: input.decisionFingerprint,
      outcome: input.outcome,
      scope: "sequence",
    }),
  }
}

export function evaluateCanonicalSequenceStepExecution(
  resolution: GrowthCanonicalDecisionResolution | null,
  context: {
    stepLabel?: string | null
    stepChannel?: string | null
    operatorOverride?: boolean
  } = {},
): GrowthCanonicalSequenceStepEnforcement {
  if (!resolution) {
    return sequenceResult({
      allowed: true,
      outcome: "canonical_decision_suppressed",
      reason: "Canonical decision unavailable — sequence path continues with existing gates.",
      decisionFingerprint: "unresolved",
    })
  }

  const { decision, suppressionHints } = resolution
  const fingerprint = decision.decisionFingerprint
  const nowMs = Date.parse(resolution.generatedAt)
  const stepText = joinLower([context.stepLabel, context.stepChannel])
  const coldStep = /cold|discovery|nurture|introduction|first touch|follow-up email|follow up email/.test(
    stepText,
  )
  const meetingAdjacent = /meeting|calendar|prep/.test(stepText)
  const nurtureWhilePrepareMeeting =
    decision.primaryAction === "prepare_meeting" && /nurture|generic|touch/.test(stepText)

  if (context.operatorOverride && canOperatorOverrideCanonicalSuppression({ resolution, scope: "sequence" })) {
    return sequenceResult({
      allowed: true,
      outcome: "canonical_decision_suppressed",
      reason: "Operator override recorded for non-safety canonical suppression.",
      decisionFingerprint: fingerprint,
    })
  }

  if (isLeadLifecycleBlockedByDecision(decision)) {
    return sequenceResult({
      allowed: false,
      outcome: "canonical_decision_lifecycle_blocked",
      reason: "Lead is archived, disqualified, suppressed, or unsubscribed.",
      decisionFingerprint: fingerprint,
    })
  }

  if (isWaitActive(decision, nowMs)) {
    return sequenceResult({
      allowed: false,
      outcome: "canonical_decision_wait_until",
      reason: decision.waitUntil
        ? `Sequence execution deferred until ${decision.waitUntil}.`
        : "Canonical decision is wait — sequence execution suppressed.",
      decisionFingerprint: fingerprint,
      waitUntil: decision.waitUntil ?? null,
    })
  }

  if (suppressionHints.suppressDuplicatePackage) {
    return sequenceResult({
      allowed: false,
      outcome: "canonical_decision_pending_approval",
      reason: "Package pending operator approval — do not send unapproved replacement copy.",
      decisionFingerprint: fingerprint,
    })
  }

  if (isRelationshipProtectionPause(decision)) {
    return sequenceResult({
      allowed: false,
      outcome: "canonical_decision_relationship_protection",
      reason: "Relationship protection pause — sequence step suppressed.",
      decisionFingerprint: fingerprint,
    })
  }

  if (suppressionHints.suppressTransport || suppressionHints.suppressSequenceSends) {
    if (nurtureWhilePrepareMeeting || (coldStep && suppressionHints.suppressColdOutreach)) {
      return sequenceResult({
        allowed: false,
        outcome: "canonical_decision_suppressed",
        reason: nurtureWhilePrepareMeeting
          ? "Current action is prepare_meeting — generic nurture touch suppressed."
          : "Cold sequence step suppressed by canonical decision.",
        decisionFingerprint: fingerprint,
        isColdOutreachStep: coldStep,
      })
    }
    if (meetingAdjacent && decision.primaryAction === "prepare_meeting") {
      return sequenceResult({
        allowed: true,
        outcome: "canonical_decision_suppressed",
        reason: "Meeting-adjacent step allowed as supporting action.",
        decisionFingerprint: fingerprint,
      })
    }
    if (suppressionHints.suppressSequenceSends) {
      return sequenceResult({
        allowed: false,
        outcome: "canonical_decision_suppressed",
        reason: suppressionHints.reasons[0] ?? "Sequence sends suppressed by canonical decision.",
        decisionFingerprint: fingerprint,
        isColdOutreachStep: coldStep,
      })
    }
  }

  if (suppressionHints.suppressColdOutreach && coldStep) {
    return sequenceResult({
      allowed: false,
      outcome: "canonical_decision_suppressed",
      reason: "Cold outreach suppressed while higher-priority work is active.",
      decisionFingerprint: fingerprint,
      isColdOutreachStep: true,
    })
  }

  if (
    decision.primaryAction === "send_promised_information" &&
    coldStep &&
    !/checklist|promised|workflow/.test(stepText)
  ) {
    return sequenceResult({
      allowed: false,
      outcome: "canonical_decision_suppressed",
      reason: "Promised information outstanding — unrelated sequence step suppressed.",
      decisionFingerprint: fingerprint,
      isColdOutreachStep: coldStep,
    })
  }

  return sequenceResult({
    allowed: true,
    outcome: "canonical_decision_suppressed",
    reason: "Canonical decision allows sequence step execution.",
    decisionFingerprint: fingerprint,
    isColdOutreachStep: coldStep,
  })
}

function transportResult(input: {
  allowed: boolean
  outcome: GrowthCanonicalTransportBoundaryOutcome
  reason: string
  decisionFingerprint: string
  requiresPackageRefresh?: boolean
}): GrowthCanonicalTransportBoundaryEnforcement {
  return {
    qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1C_QA_MARKER,
    allowed: input.allowed,
    outcome: input.outcome,
    reason: input.reason,
    requiresPackageRefresh: input.requiresPackageRefresh === true,
    enforcementFingerprint: buildCanonicalEnforcementFingerprint({
      decisionFingerprint: input.decisionFingerprint,
      outcome: input.outcome,
      scope: "transport",
    }),
  }
}

export function evaluateCanonicalTransportBoundary(
  resolution: GrowthCanonicalDecisionResolution | null,
  context: {
    packageFingerprintAtApproval?: string | null
    channel?: string | null
    operatorOverride?: boolean
    humanApproved?: boolean
  } = {},
): GrowthCanonicalTransportBoundaryEnforcement {
  if (!resolution) {
    return transportResult({
      allowed: true,
      outcome: "transport_allowed",
      reason: "Canonical decision unavailable — existing transport gates remain authoritative.",
      decisionFingerprint: "unresolved",
    })
  }

  const { decision, freshness, suppressionHints } = resolution
  const fingerprint = decision.decisionFingerprint
  const nowMs = Date.parse(resolution.generatedAt)

  if (!context.humanApproved) {
    return transportResult({
      allowed: false,
      outcome: "transport_blocked_waiting_on_operator",
      reason: "Missing operator approval.",
      decisionFingerprint: fingerprint,
    })
  }

  if (context.operatorOverride && canOperatorOverrideCanonicalSuppression({ resolution, scope: "transport" })) {
    return transportResult({
      allowed: true,
      outcome: "transport_allowed",
      reason: "Operator override recorded for non-safety canonical suppression.",
      decisionFingerprint: fingerprint,
    })
  }

  if (isLeadLifecycleBlockedByDecision(decision)) {
    return transportResult({
      allowed: false,
      outcome: "transport_blocked_lifecycle",
      reason: "Lead is no longer eligible for outbound transport.",
      decisionFingerprint: fingerprint,
    })
  }

  if (isWaitActive(decision, nowMs)) {
    return transportResult({
      allowed: false,
      outcome: "transport_blocked_waiting_on_prospect",
      reason: decision.waitUntil
        ? `Prospect requested wait until ${decision.waitUntil}.`
        : "Canonical decision is wait — transport blocked.",
      decisionFingerprint: fingerprint,
    })
  }

  if (freshness.state === "strategy_changed") {
    return transportResult({
      allowed: false,
      outcome: "transport_blocked_strategy_changed",
      reason: "Strategy changed after package approval — send blocked without rewriting approved copy.",
      decisionFingerprint: fingerprint,
      requiresPackageRefresh: true,
    })
  }

  if (freshness.stalePackageRelativeToDecision || freshness.state === "package_needs_refresh") {
    return transportResult({
      allowed: false,
      outcome: "transport_blocked_stale_package",
      reason: "Package needs refresh before transport can proceed.",
      decisionFingerprint: fingerprint,
      requiresPackageRefresh: true,
    })
  }

  if (decision.operatorReviewRequired && suppressionHints.suppressTransport) {
    return transportResult({
      allowed: false,
      outcome: "transport_blocked_waiting_on_operator",
      reason: "Package or decision still requires operator review.",
      decisionFingerprint: fingerprint,
    })
  }

  if (suppressionHints.suppressTransport) {
    return transportResult({
      allowed: false,
      outcome: "transport_blocked_canonical_suppression",
      reason: suppressionHints.reasons[0] ?? "Canonical decision blocks transport.",
      decisionFingerprint: fingerprint,
    })
  }

  if (
    context.packageFingerprintAtApproval &&
    freshness.packageFingerprint &&
    context.packageFingerprintAtApproval !== freshness.packageFingerprint &&
    freshness.stalePackageRelativeToDecision
  ) {
    return transportResult({
      allowed: false,
      outcome: "transport_blocked_stale_package",
      reason: "Approved package fingerprint no longer matches the current canonical package.",
      decisionFingerprint: fingerprint,
      requiresPackageRefresh: true,
    })
  }

  return transportResult({
    allowed: true,
    outcome: "transport_allowed",
    reason: "Canonical decision consistent with transport send.",
    decisionFingerprint: fingerprint,
  })
}

export function canOperatorOverrideCanonicalSuppression(input: {
  resolution: GrowthCanonicalDecisionResolution | null
  scope: "sequence" | "transport" | "growth5f"
}): boolean {
  if (!input.resolution) return false
  const { decision, suppressionHints } = input.resolution
  if (isLeadLifecycleBlockedByDecision(decision)) return false
  if (decision.transportBlocked && suppressionHints.suppressTransport) return false
  if (suppressionHints.reasons.some((row) => /compliance|kill switch|unsubscribe/i.test(row))) {
    return false
  }
  if (decision.operatorReviewRequired && input.scope === "transport") return false
  return true
}

export function projectCanonicalDecisionHacEnforcement(
  resolution: GrowthCanonicalDecisionResolution | null,
  packagePreparation?: GrowthCanonicalPackagePreparationEnforcement | null,
): GrowthCanonicalHacEnforcementProjection {
  if (!resolution) {
    return {
      status: "allowed_to_proceed",
      label: "Allowed to proceed",
      summary: "Canonical decision unavailable — existing approval gates remain authoritative.",
      recommendation: "Review package and approve when ready.",
      essentials: ["Enforcement: existing approval gates only"],
    }
  }

  const enforcement =
    packagePreparation ?? evaluateGrowth5fPackagePreparation(resolution, { proposedPurpose: resolution.decision.title })
  let status: GrowthCanonicalHacEnforcementStatus = "allowed_to_proceed"

  if (isLeadLifecycleBlockedByDecision(resolution.decision)) {
    status = "lead_no_longer_eligible"
  } else if (enforcement.outcome === "decision_refresh_required" || resolution.freshness.state === "strategy_changed") {
    status = resolution.freshness.state === "strategy_changed" ? "strategy_changed" : "package_refresh_required"
  } else if (enforcement.outcome === "decision_blocked_waiting_on_prospect" || resolution.decision.primaryAction === "wait") {
    status = "waiting_on_prospect"
  } else if (
    enforcement.outcome === "decision_blocked_waiting_on_operator" ||
    resolution.decision.operatorReviewRequired
  ) {
    status = "waiting_on_operator"
  } else if (enforcement.outcome === "decision_blocked_competing_package") {
    status = "competing_action_suppressed"
  } else if (resolution.freshness.state === "package_needs_refresh") {
    status = "package_refresh_required"
  }

  const label = status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .replace(/No longer eligible/i, "no longer eligible")

  const statusLabels: Record<GrowthCanonicalHacEnforcementStatus, string> = {
    allowed_to_proceed: "Allowed to proceed",
    waiting_on_operator: "Waiting on operator",
    waiting_on_prospect: "Waiting on prospect",
    strategy_changed: "Strategy changed",
    competing_action_suppressed: "Competing action suppressed",
    package_refresh_required: "Package refresh required",
    lead_no_longer_eligible: "Lead no longer eligible",
  }

  return {
    status,
    label: statusLabels[status],
    summary: enforcement.reason,
    recommendation: resolution.decision.title,
    essentials: [
      `Enforcement: ${statusLabels[status]}`,
      enforcement.reason,
      `Ava recommends: ${resolution.decision.title}`,
      resolution.freshness.label ? `Freshness: ${resolution.freshness.label}` : "Freshness: Current",
    ].filter(Boolean),
  }
}

export function shouldBlockCompetingOutreachPackageFromDecision(
  resolution: GrowthCanonicalDecisionResolution | null,
  context: GrowthCanonicalPackagePreparationContext = {},
): boolean {
  return !evaluateGrowth5fPackagePreparation(resolution, context).allowed
}
