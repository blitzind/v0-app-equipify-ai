/** Outreach readiness gate — block fake execution readiness without reachable humans. Client-safe. */

import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import {
  hasProspectSearchReachableHumans,
  resolveProspectSearchReachableHumanScore,
  type ProspectSearchReachableHumanSnapshot,
} from "@/lib/growth/prospect-search/prospect-search-reachable-human-scoring"

export const GROWTH_OUTREACH_READINESS_GATE_QA_MARKER = "growth-outreach-readiness-gate-v1" as const

export type ProspectSearchOutreachReadinessGateState =
  | "ready"
  | "review_required"
  | "contact_acquisition_required"
  | "blocked"

export type ProspectSearchOutreachReadinessGate = {
  qa_marker: typeof GROWTH_OUTREACH_READINESS_GATE_QA_MARKER
  state: ProspectSearchOutreachReadinessGateState
  gated: boolean
  operator_override_allowed: boolean
  blockers: string[]
  reasons: string[]
  reachable: ProspectSearchReachableHumanSnapshot
}

export function resolveProspectSearchOutreachReadinessGate(input: {
  company: GrowthProspectSearchCompanyResult
  operator_override?: boolean
  reachable?: ProspectSearchReachableHumanSnapshot
}): ProspectSearchOutreachReadinessGate {
  const reachable = input.reachable ?? resolveProspectSearchReachableHumanScore(input.company)
  const blockers: string[] = []
  const reasons: string[] = []

  if (input.company.is_suppressed) {
    return {
      qa_marker: GROWTH_OUTREACH_READINESS_GATE_QA_MARKER,
      state: "blocked",
      gated: true,
      operator_override_allowed: false,
      blockers: [input.company.suppression_reason ?? "Account suppressed"],
      reasons: ["Compliance block active"],
      reachable,
    }
  }

  if (input.operator_override) {
    return {
      qa_marker: GROWTH_OUTREACH_READINESS_GATE_QA_MARKER,
      state: "review_required",
      gated: false,
      operator_override_allowed: true,
      blockers: [],
      reasons: ["Operator override acknowledged"],
      reachable,
    }
  }

  if (reachable.label === "outreach_ready") {
    reasons.push("Reachable human threshold met")
    return {
      qa_marker: GROWTH_OUTREACH_READINESS_GATE_QA_MARKER,
      state: "ready",
      gated: false,
      operator_override_allowed: true,
      blockers: [],
      reasons,
      reachable,
    }
  }

  if (hasProspectSearchReachableHumans(reachable)) {
    blockers.push("Verified channel coverage incomplete for confident outreach")
    reasons.push("Partial contactability — review before launch")
    return {
      qa_marker: GROWTH_OUTREACH_READINESS_GATE_QA_MARKER,
      state: "review_required",
      gated: true,
      operator_override_allowed: true,
      blockers,
      reasons,
      reachable,
    }
  }

  blockers.push("No reachable humans discovered")
  reasons.push("Contact acquisition required before outreach execution")
  return {
    qa_marker: GROWTH_OUTREACH_READINESS_GATE_QA_MARKER,
    state: "contact_acquisition_required",
    gated: true,
    operator_override_allowed: true,
    blockers,
    reasons,
    reachable,
  }
}

export function isProspectSearchOutreachExecutionBlocked(
  gate: ProspectSearchOutreachReadinessGate,
): boolean {
  return gate.gated && gate.state !== "ready"
}
