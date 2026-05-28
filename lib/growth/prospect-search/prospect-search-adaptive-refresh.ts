/** Adaptive refresh prioritization — evidence-backed, operator-controlled. Client-safe. */

import type { ProspectSearchAccountProgression } from "@/lib/growth/prospect-search/prospect-search-account-progression"
import type { ProspectSearchCompanyContactCoverageIntelligence } from "@/lib/growth/prospect-search/prospect-search-company-contact-coverage-intelligence"
import type { ProspectSearchOpportunityEmergence } from "@/lib/growth/prospect-search/prospect-search-opportunity-emergence"
import type { ProspectSearchRelationshipMemorySnapshot } from "@/lib/growth/prospect-search/prospect-search-relationship-memory"
import type { ProspectSearchSequenceReadiness } from "@/lib/growth/prospect-search/prospect-search-sequence-readiness"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthProspectSearchPeopleResultRow } from "@/lib/growth/prospect-search/prospect-search-contact-discovery"

export const GROWTH_ADAPTIVE_REFRESH_QA_MARKER = "growth-adaptive-refresh-v1" as const

export type ProspectSearchAdaptiveRefreshSnapshot = {
  qa_marker: typeof GROWTH_ADAPTIVE_REFRESH_QA_MARKER
  refresh_priority_score: number
  refresh_recommended: boolean
  refresh_urgency: "low" | "moderate" | "high"
  refresh_reasons: string[]
  refresh_timing_rationale: string
  deprioritized: boolean
  deprioritize_reason: string | null
  safety_notes: string[]
  evidence_backed: boolean
}

export function computeAdaptiveRefreshPriority(input: {
  company: GrowthProspectSearchCompanyResult
  peopleRows: GrowthProspectSearchPeopleResultRow[]
  coverage: ProspectSearchCompanyContactCoverageIntelligence
  relationshipMemory?: ProspectSearchRelationshipMemorySnapshot | null
  accountProgression?: ProspectSearchAccountProgression | null
  opportunityEmergence?: ProspectSearchOpportunityEmergence | null
  sequenceReadiness?: ProspectSearchSequenceReadiness | null
  territory_score?: number | null
  in_active_queue?: boolean
}): ProspectSearchAdaptiveRefreshSnapshot {
  const refresh_reasons: string[] = []
  const safety_notes = [
    "Refresh preserves evidence lineage and operator notes",
    "Stronger existing evidence is never overwritten silently",
  ]
  let score = 0

  const staleCount = input.peopleRows.filter(
    (row) => row.freshness_status === "stale" || row.freshness_status === "expired",
  ).length

  if (input.company.is_suppressed) {
    return {
      qa_marker: GROWTH_ADAPTIVE_REFRESH_QA_MARKER,
      refresh_priority_score: 0,
      refresh_recommended: false,
      refresh_urgency: "low",
      refresh_reasons: ["Account suppressed — refresh deprioritized"],
      refresh_timing_rationale: "Resolve compliance block first",
      deprioritized: true,
      deprioritize_reason: "Blocked account",
      safety_notes,
      evidence_backed: true,
    }
  }

  if (staleCount > 0) {
    score += Math.min(25, staleCount * 8)
    refresh_reasons.push(`${staleCount} stale or expired contact verification(s)`)
  }

  if (input.opportunityEmergence?.opportunity_trend === "improving") {
    score += 12
    refresh_reasons.push("Opportunity emergence trend improving — fresh data valuable")
  }
  if (
    input.opportunityEmergence?.emergence_tier === "accelerating" ||
    input.opportunityEmergence?.emergence_tier === "outreach_ready"
  ) {
    score += 14
    refresh_reasons.push("Accelerating opportunity — refresh before outreach push")
  }

  if (input.relationshipMemory?.momentum_direction === "strengthening") {
    score += 10
    refresh_reasons.push("Relationship momentum strengthening")
  }

  if (input.in_active_queue) {
    score += 8
    refresh_reasons.push("Account present in active operator queue")
  }

  if ((input.territory_score ?? 0) >= 65) {
    score += 8
    refresh_reasons.push("Territory opportunity concentration elevated")
  }

  if (
    input.sequenceReadiness?.readiness_state === "ready" ||
    input.sequenceReadiness?.readiness_state === "ready_with_review"
  ) {
    score += 10
    refresh_reasons.push("Sequence-ready — verification freshness supports outreach")
  }

  if (input.coverage.persona_completeness < 45) {
    score += 8
    refresh_reasons.push("Missing operational personas — refresh may discover contacts")
  }

  if (
    input.opportunityEmergence?.emergence_tier === "cooling" &&
    staleCount === 0 &&
    !input.in_active_queue
  ) {
    score = Math.max(0, score - 20)
    return {
      qa_marker: GROWTH_ADAPTIVE_REFRESH_QA_MARKER,
      refresh_priority_score: score,
      refresh_recommended: false,
      refresh_urgency: "low",
      refresh_reasons: [...refresh_reasons, "Cooling account with no stale signals"],
      refresh_timing_rationale: "Deprioritized — low signal for refresh spend",
      deprioritized: true,
      deprioritize_reason: "Inactive stale account with cooling signals",
      safety_notes,
      evidence_backed: refresh_reasons.length > 0,
    }
  }

  score = Math.round(Math.min(100, Math.max(0, score)))
  const refresh_recommended = score >= 35 || staleCount > 0
  const refresh_urgency: ProspectSearchAdaptiveRefreshSnapshot["refresh_urgency"] =
    score >= 65 || staleCount >= 2 ? "high" : score >= 35 ? "moderate" : "low"

  let refresh_timing_rationale = "No immediate refresh required"
  if (refresh_recommended) {
    refresh_timing_rationale =
      staleCount > 0
        ? "Refresh recommended before outreach or sequencing"
        : "Refresh while opportunity and territory signals are elevated"
  }

  return {
    qa_marker: GROWTH_ADAPTIVE_REFRESH_QA_MARKER,
    refresh_priority_score: score,
    refresh_recommended,
    refresh_urgency,
    refresh_reasons: refresh_reasons.slice(0, 6),
    refresh_timing_rationale,
    deprioritized: false,
    deprioritize_reason: null,
    safety_notes,
    evidence_backed: refresh_reasons.length > 0,
  }
}

export function resolveAdaptiveRefreshQueueBoost(
  snapshot: ProspectSearchAdaptiveRefreshSnapshot | null | undefined,
): number {
  if (!snapshot || snapshot.deprioritized || !snapshot.refresh_recommended) return 0
  if (snapshot.refresh_urgency === "high") return 2
  if (snapshot.refresh_urgency === "moderate") return 1
  return 0
}
