/**
 * SV1-1 / ARCH-1A — Resource Allocation Facade engine (client-safe).
 * Composes existing signals into Investment State. Does not re-qualify or re-budget.
 */

import {
  AI_OS_INVESTMENT_STATES,
  AI_OS_RESOURCE_ALLOCATION_DEFAULT_MODE,
  AI_OS_RESOURCE_ALLOCATION_QA_MARKER,
  AI_OS_RESOURCE_COST_TIER_BY_CLASS,
  AI_OS_SCARCE_RESOURCE_CLASSES,
  type AiOsInvestmentState,
  type AiOsResourceAllocationDecision,
  type AiOsResourceAllocationRequest,
  type AiOsScarceResourceClass,
} from "@/lib/growth/resource-allocation/resource-allocation-types"
import { GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE } from "@/lib/growth/outreach/growth-autonomous-revenue-loop-1a"

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function isKnownResourceClass(value: string): value is AiOsScarceResourceClass {
  return (AI_OS_SCARCE_RESOURCE_CLASSES as readonly string[]).includes(value)
}

function isKnownInvestmentState(value: string): value is AiOsInvestmentState {
  return (AI_OS_INVESTMENT_STATES as readonly string[]).includes(value)
}

/**
 * Whether a projected investment state authorizes additional spend for a cost tier.
 * Outbound transport remains approval-gated elsewhere — facade never authorizes outbound send.
 * Maintain = no additional unit; Pending = low-cost validation only; Increase = low_cost + billable.
 */
export function authorizeSpendForInvestmentState(
  state: AiOsInvestmentState,
  costTier: ReturnType<typeof costTierForResource>,
): boolean {
  if (costTier === "outbound") return false
  switch (state) {
    case "stop_investment":
    case "reduce_investment":
    case "maintain_investment":
      return false
    case "pending_investment":
      return costTier === "low_cost"
    case "increase_investment":
      return costTier === "low_cost" || costTier === "billable"
    default:
      return false
  }
}

export function costTierForResource(resourceClass: AiOsScarceResourceClass) {
  return AI_OS_RESOURCE_COST_TIER_BY_CLASS[resourceClass]
}

/**
 * Project Investment State from existing authoritative signals.
 * Does not invent qualification scores — only maps provided recommendations/gates.
 */
export function projectInvestmentStateFromSignals(
  input: AiOsResourceAllocationRequest,
): {
  investment_state: AiOsInvestmentState
  reason: string
  confidence: number
  blocking_conditions: string[]
  next_review: string | null
} {
  const signals = input.signals ?? {}
  const blocking: string[] = []
  const resourceClass = input.resourceClass
  const costTier = costTierForResource(resourceClass)

  if (!isKnownResourceClass(resourceClass)) {
    return {
      investment_state: "stop_investment",
      reason: "Unknown resource class — fail closed.",
      confidence: 1,
      blocking_conditions: ["unknown_resource_class"],
      next_review: null,
    }
  }

  if (signals.killSwitchActive === true) {
    blocking.push("kill_switch_active")
    return {
      investment_state: "stop_investment",
      reason: "Autonomy kill switch active — Stop Investment.",
      confidence: 1,
      blocking_conditions: blocking,
      next_review: null,
    }
  }

  if (signals.stopConditionActive === true) {
    blocking.push("stop_condition_active")
    return {
      investment_state: "stop_investment",
      reason: signals.stopConditionReason?.trim() || "Stop condition active — Stop Investment.",
      confidence: 1,
      blocking_conditions: blocking,
      next_review: null,
    }
  }

  if (signals.autonomyAllowed === false) {
    blocking.push("autonomy_blocked")
    return {
      investment_state: "stop_investment",
      reason: signals.autonomyBlockedReason?.trim() || "Autonomy policy denied — Stop Investment.",
      confidence: 0.95,
      blocking_conditions: blocking,
      next_review: null,
    }
  }

  const admission = signals.admission?.state ?? "unknown"
  if (admission === "rejected" || admission === "invalid") {
    blocking.push(`admission_${admission}`)
    return {
      investment_state: "stop_investment",
      reason: `Admission ${admission} — Stop Investment (admission remains authoritative).`,
      confidence: 1,
      blocking_conditions: blocking,
      next_review: null,
    }
  }

  if (signals.budgetAvailable === false) {
    blocking.push("budget_exhausted")
    return {
      investment_state: "reduce_investment",
      reason: "Budget unavailable for this resource class — Reduce Investment (budgets remain authoritative).",
      confidence: 0.95,
      blocking_conditions: blocking,
      next_review: "when_budget_resets",
    }
  }

  if (signals.budgetPressure === true) {
    blocking.push("budget_pressure")
  }

  if (admission === "review" || signals.admission?.requiresHumanReview === true) {
    blocking.push("admission_review")
    return {
      investment_state: "pending_investment",
      reason: "Admission requires review — Pending Investment (only low-cost validation allowed).",
      confidence: 0.9,
      blocking_conditions: blocking,
      next_review: "after_admission_review",
    }
  }

  if (signals.approvalRequired === true && signals.approvalGranted !== true) {
    blocking.push("approval_required")
    return {
      investment_state: "pending_investment",
      reason: "Human approval required before further investment — Pending Investment.",
      confidence: 0.92,
      blocking_conditions: blocking,
      next_review: "after_human_approval",
    }
  }

  const recommendation = (signals.qualificationRecommendation ?? "").toLowerCase()
  if (
    /abandon|disqualif|stop_investment|reject/.test(recommendation) ||
    recommendation === "abandon" ||
    recommendation === "abandon_lead"
  ) {
    blocking.push("qualification_stop")
    return {
      investment_state: "stop_investment",
      reason: "Existing qualification recommends abandon/stop — Stop Investment (qualification remains authoritative).",
      confidence: 0.9,
      blocking_conditions: blocking,
      next_review: null,
    }
  }

  const confidence = clamp01(
    typeof signals.evidenceConfidence === "number" ? signals.evidenceConfidence : 0.5,
  )

  // Fresh research already exists — do not authorize additional expensive research spend.
  if (
    resourceClass === "website_research" &&
    signals.researchFresh === true &&
    signals.hasUsableResearch === true
  ) {
    return {
      investment_state: "maintain_investment",
      reason: "Fresh research already exists — Maintain Investment (freshness remains authoritative).",
      confidence: Math.max(confidence, 0.85),
      blocking_conditions: blocking,
      next_review: "on_stale_refresh",
    }
  }

  if (costTier === "billable" || costTier === "outbound") {
    if (confidence < 0.45 && signals.hasUsableResearch !== true) {
      blocking.push("insufficient_confidence_for_billable")
      return {
        investment_state: "pending_investment",
        reason:
          "Insufficient evidence confidence for billable spend — Pending Investment (progressive confidence).",
        confidence,
        blocking_conditions: blocking,
        next_review: "after_low_cost_validation",
      }
    }
  }

  if (signals.budgetPressure === true && costTier !== "low_cost") {
    return {
      investment_state: "reduce_investment",
      reason: "Budget pressure — Reduce Investment; defer expensive work.",
      confidence: Math.max(confidence, 0.7),
      blocking_conditions: blocking,
      next_review: "when_budget_pressure_clears",
    }
  }

  if (
    /continue_research|needs.?more.?research|research_company|monitor/.test(recommendation) &&
    costTier === "billable"
  ) {
    return {
      investment_state: "pending_investment",
      reason: "Existing recommendation prefers more research before billable investment — Pending.",
      confidence: Math.max(confidence, 0.7),
      blocking_conditions: blocking,
      next_review: "after_research",
    }
  }

  if (
    admission === "accepted" &&
    confidence >= GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE &&
    signals.budgetAvailable !== false &&
    signals.hasUsableResearch === true &&
    (/prepare_outreach|pursue|enroll|qualified|outreach|draft/.test(recommendation) ||
      recommendation === "" ||
      /continue/.test(recommendation))
  ) {
    if (costTier === "outbound") {
      return {
        investment_state: "increase_investment",
        reason:
          "Research-complete account earned preparation investment; outbound transport stays approval-gated elsewhere.",
        confidence,
        blocking_conditions: [...blocking, "outbound_requires_separate_approval"],
        next_review: "after_approval_for_send",
      }
    }
    return {
      investment_state: "increase_investment",
      reason:
        "Research-complete account earned downstream investment after canonical early-outreach qualification.",
      confidence,
      blocking_conditions: blocking,
      next_review: null,
    }
  }

  if (
    admission === "accepted" &&
    confidence >= 0.7 &&
    signals.budgetAvailable !== false &&
    (/pursue|prepare_outreach|enroll|increase|continue/.test(recommendation) ||
      recommendation === "" ||
      /qualified/.test(recommendation))
  ) {
    if (costTier === "outbound") {
      return {
        investment_state: "increase_investment",
        reason:
          "Account earned investment for preparation, but outbound transport stays approval-gated elsewhere.",
        confidence,
        blocking_conditions: [...blocking, "outbound_requires_separate_approval"],
        next_review: "after_approval_for_send",
      }
    }
    return {
      investment_state: "increase_investment",
      reason: "Admission accepted with sufficient confidence and budget — Increase Investment.",
      confidence,
      blocking_conditions: blocking,
      next_review: null,
    }
  }

  if (admission === "accepted" || admission === "unknown") {
    if (costTier === "low_cost") {
      return {
        investment_state: signals.researchStale === true ? "increase_investment" : "maintain_investment",
        reason:
          signals.researchStale === true
            ? "Stale research — authorize low-cost refresh (Increase for research only)."
            : "Continue current low-cost work — Maintain Investment.",
        confidence: Math.max(confidence, 0.6),
        blocking_conditions: blocking,
        next_review: signals.researchStale === true ? null : "on_signal_change",
      }
    }
    return {
      investment_state: "maintain_investment",
      reason: "Continue current work without additional expensive authorization — Maintain Investment.",
      confidence: Math.max(confidence, 0.55),
      blocking_conditions: blocking,
      next_review: "on_signal_change",
    }
  }

  // Fail closed for unrecognized combinations
  blocking.push("fail_closed_unknown_posture")
  return {
    investment_state: "pending_investment",
    reason: "Unable to project a clear investment posture — fail closed to Pending Investment.",
    confidence: 0.4,
    blocking_conditions: blocking,
    next_review: "manual_review",
  }
}

export function evaluateResourceAllocationFacade(
  input: AiOsResourceAllocationRequest,
): AiOsResourceAllocationDecision {
  const mode = input.mode ?? AI_OS_RESOURCE_ALLOCATION_DEFAULT_MODE
  const decidedAt = new Date().toISOString()

  if (!input.organizationId?.trim() || !input.accountId?.trim()) {
    return {
      qaMarker: AI_OS_RESOURCE_ALLOCATION_QA_MARKER,
      investment_state: "stop_investment",
      spend_authorized: false,
      reason: "Missing organization or account identity — fail closed.",
      confidence: 1,
      blocking_conditions: ["missing_identity"],
      next_review: null,
      supporting_signals: input.signals ?? {},
      resource_class: isKnownResourceClass(input.resourceClass) ? input.resourceClass : "other_scarce",
      cost_tier: "billable",
      mode,
      enforcement_applied: false,
      decided_at: decidedAt,
    }
  }

  if (!isKnownResourceClass(input.resourceClass)) {
    return {
      qaMarker: AI_OS_RESOURCE_ALLOCATION_QA_MARKER,
      investment_state: "stop_investment",
      spend_authorized: false,
      reason: "Unknown resource class — fail closed.",
      confidence: 1,
      blocking_conditions: ["unknown_resource_class"],
      next_review: null,
      supporting_signals: input.signals ?? {},
      resource_class: "other_scarce",
      cost_tier: "billable",
      mode,
      enforcement_applied: false,
      decided_at: decidedAt,
    }
  }

  const projected = projectInvestmentStateFromSignals(input)
  if (!isKnownInvestmentState(projected.investment_state)) {
    return {
      qaMarker: AI_OS_RESOURCE_ALLOCATION_QA_MARKER,
      investment_state: "stop_investment",
      spend_authorized: false,
      reason: "Unknown investment state projection — fail closed.",
      confidence: 1,
      blocking_conditions: ["unknown_investment_state"],
      next_review: null,
      supporting_signals: input.signals ?? {},
      resource_class: input.resourceClass,
      cost_tier: costTierForResource(input.resourceClass),
      mode,
      enforcement_applied: false,
      decided_at: decidedAt,
    }
  }

  const costTier = costTierForResource(input.resourceClass)
  const spendAuthorized = authorizeSpendForInvestmentState(projected.investment_state, costTier)

  return {
    qaMarker: AI_OS_RESOURCE_ALLOCATION_QA_MARKER,
    investment_state: projected.investment_state,
    spend_authorized: spendAuthorized,
    reason: projected.reason,
    confidence: clamp01(projected.confidence),
    blocking_conditions: projected.blocking_conditions,
    next_review: projected.next_review,
    supporting_signals: input.signals ?? {},
    resource_class: input.resourceClass,
    cost_tier: costTier,
    mode,
    // Shadow never applies enforcement; enforce mode still false until SV1 enforce milestone.
    enforcement_applied: false,
    decided_at: decidedAt,
  }
}
