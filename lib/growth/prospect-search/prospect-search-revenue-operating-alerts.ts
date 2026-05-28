/** Revenue operating alerts — evidence-backed account change surfacing. Client-safe. */

import type { ProspectSearchAccountContactStrategy } from "@/lib/growth/prospect-search/prospect-search-account-contact-strategy"
import type { ProspectSearchAccountProgression } from "@/lib/growth/prospect-search/prospect-search-account-progression"
import type { ProspectSearchAccountTimeline } from "@/lib/growth/prospect-search/prospect-search-account-timeline"
import type { ProspectSearchOpportunityEmergence } from "@/lib/growth/prospect-search/prospect-search-opportunity-emergence"
import type { ProspectSearchRelationshipMemorySnapshot } from "@/lib/growth/prospect-search/prospect-search-relationship-memory"
import type { ProspectSearchSequenceReadiness } from "@/lib/growth/prospect-search/prospect-search-sequence-readiness"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthProspectSearchPeopleResultRow } from "@/lib/growth/prospect-search/prospect-search-contact-discovery"

export const GROWTH_REVENUE_OPERATING_ALERTS_QA_MARKER = "growth-revenue-operating-alerts-v1" as const

export const PROSPECT_SEARCH_OPERATING_ALERT_KINDS = [
  "decision_maker_discovered",
  "relationship_warming",
  "account_stalled",
  "verification_expired",
  "contact_call_ready",
  "territory_opportunity_surge",
  "blocked_contact_discovered",
  "sequence_ready",
  "opportunity_accelerating",
  "progression_regression",
  "coverage_improved",
  "research_needed",
] as const

export type ProspectSearchOperatingAlertKind =
  (typeof PROSPECT_SEARCH_OPERATING_ALERT_KINDS)[number]

export type ProspectSearchOperatingAlert = {
  id: string
  kind: ProspectSearchOperatingAlertKind
  title: string
  detail: string
  urgency: "low" | "moderate" | "high"
  suggested_action: string
  evidence: string[]
  occurred_at: string | null
  dismissible: boolean
}

export type ProspectSearchOperatingAlertsSnapshot = {
  qa_marker: typeof GROWTH_REVENUE_OPERATING_ALERTS_QA_MARKER
  alerts: ProspectSearchOperatingAlert[]
  alert_summary: string | null
}

export function buildProspectSearchOperatingAlerts(input: {
  company: GrowthProspectSearchCompanyResult
  peopleRows: GrowthProspectSearchPeopleResultRow[]
  accountStrategy: ProspectSearchAccountContactStrategy
  relationshipMemory?: ProspectSearchRelationshipMemorySnapshot | null
  accountProgression?: ProspectSearchAccountProgression | null
  accountTimeline?: ProspectSearchAccountTimeline | null
  opportunityEmergence?: ProspectSearchOpportunityEmergence | null
  sequenceReadiness?: ProspectSearchSequenceReadiness | null
  territory_score?: number | null
}): ProspectSearchOperatingAlertsSnapshot {
  const alerts: ProspectSearchOperatingAlert[] = []

  const push = (
    kind: ProspectSearchOperatingAlertKind,
    title: string,
    detail: string,
    urgency: ProspectSearchOperatingAlert["urgency"],
    suggested_action: string,
    evidence: string[],
    occurred_at: string | null = null,
  ) => {
    alerts.push({
      id: `${kind}:${title.slice(0, 24)}`,
      kind,
      title,
      detail,
      urgency,
      suggested_action,
      evidence,
      occurred_at,
      dismissible: true,
    })
  }

  for (const row of input.peopleRows) {
    if (
      row.persona_type === "owner" ||
      row.persona_type === "decision_maker" ||
      row.persona_type === "operations_manager"
    ) {
      push(
        "decision_maker_discovered",
        `${row.persona_label} identified`,
        `${row.full_name ?? "Contact"} — ${row.title ?? "title evidence"}`,
        "moderate",
        "Review contact in account strategy before outreach",
        row.persona_evidence.slice(0, 2),
        row.discovered_at ?? row.last_checked_at,
      )
      break
    }
  }

  if (input.relationshipMemory?.relationship_status === "warming") {
    push(
      "relationship_warming",
      "Relationship warming",
      input.relationshipMemory.strength_reasons[0] ?? "Observed engagement signals",
      "moderate",
      input.relationshipMemory.recommended_next_action,
      input.relationshipMemory.strength_reasons.slice(0, 2),
      input.relationshipMemory.last_interaction_at,
    )
  }

  if (
    input.accountProgression?.progression_state === "stalled" ||
    input.relationshipMemory?.relationship_status === "stalled"
  ) {
    push(
      "account_stalled",
      "Account stalled",
      input.accountProgression?.progression_blockers[0] ??
        "No recent interaction on timeline",
      "high",
      "Refresh contacts and review relationship before re-engaging",
      input.accountProgression?.progression_reasons.slice(0, 2) ?? [],
      input.relationshipMemory?.last_interaction_at ?? null,
    )
  }

  for (const row of input.peopleRows) {
    if (row.freshness_status === "expired" || row.freshness_status === "stale") {
      push(
        "verification_expired",
        "Verification stale",
        `${row.full_name ?? "Contact"} — ${row.stale_warning ?? "refresh recommended"}`,
        "moderate",
        "Refresh contact verification before outreach",
        [row.freshness_status],
        row.last_verified_at,
      )
      break
    }
  }

  for (const row of input.peopleRows) {
    if (row.call_ready && row.call_eligibility === "eligible") {
      push(
        "contact_call_ready",
        "Contact became call-ready",
        `${row.full_name ?? row.persona_label} — call channel eligible`,
        "moderate",
        "Review call queue or account sequence readiness",
        row.ranking_reasons.slice(0, 2),
        row.last_verified_at,
      )
      break
    }
  }

  if ((input.territory_score ?? 0) >= 75) {
    push(
      "territory_opportunity_surge",
      "Territory opportunity surge",
      "Account in high-opportunity territory cluster",
      "moderate",
      "Prioritize territory-focused outreach workflow",
      [`Territory score ${input.territory_score}`],
      null,
    )
  }

  if (input.accountStrategy.blocked_contacts.length > 0) {
    const blocked = input.accountStrategy.blocked_contacts[0]!
    push(
      "blocked_contact_discovered",
      "Blocked contact on account",
      `${blocked.full_name ?? "Contact"}: ${blocked.block_reason ?? "compliance"}`,
      "high",
      "Avoid blocked contact — use account strategy primary instead",
      [blocked.block_reason ?? "blocked"],
      null,
    )
  }

  if (
    input.sequenceReadiness?.readiness_state === "ready" ||
    input.sequenceReadiness?.readiness_state === "ready_with_review"
  ) {
    push(
      "sequence_ready",
      "Sequence-ready account",
      input.sequenceReadiness.suggested_sequence_type,
      input.sequenceReadiness.readiness_state === "ready" ? "high" : "moderate",
      input.sequenceReadiness.suggested_sequence_type,
      input.sequenceReadiness.readiness_reasons.slice(0, 2),
      null,
    )
  }

  if (
    input.opportunityEmergence?.emergence_tier === "accelerating" ||
    input.opportunityEmergence?.emergence_tier === "outreach_ready"
  ) {
    push(
      "opportunity_accelerating",
      "Opportunity accelerating",
      input.opportunityEmergence.emergence_reasons[0] ?? "Operational signals increasing",
      input.opportunityEmergence.urgency_level === "high" ? "high" : "moderate",
      input.opportunityEmergence.recommended_next_action,
      input.opportunityEmergence.emergence_reasons.slice(0, 2),
      null,
    )
  }

  if (
    input.accountProgression?.momentum_trend === "weakening" ||
    input.opportunityEmergence?.opportunity_trend === "declining"
  ) {
    push(
      "progression_regression",
      "Progression regression",
      input.accountProgression?.progression_blockers[0] ?? "Momentum declining on timeline",
      "moderate",
      input.accountProgression?.next_best_action ?? "Review account before outreach",
      input.accountProgression?.progression_reasons.slice(0, 2) ?? [],
      null,
    )
  }

  if (input.accountStrategy.account_outreach_readiness === "research_needed") {
    push(
      "research_needed",
      "Research needed",
      input.accountStrategy.contact_research_next_step ?? "Complete contact research",
      "moderate",
      input.accountStrategy.safest_next_action,
      input.accountStrategy.strategy_reasons.slice(0, 2),
      null,
    )
  }

  const recentTimeline = input.accountTimeline?.events.slice(0, 3) ?? []
  if (
    recentTimeline.some((e) => e.kind === "discovery" || e.kind === "contact_change") &&
    input.peopleRows.length >= 2
  ) {
    push(
      "coverage_improved",
      "Coverage improved",
      "Multiple contacts or new discovery events on timeline",
      "low",
      "Review updated account strategy",
      recentTimeline.map((e) => e.label).slice(0, 2),
      recentTimeline[0]?.occurred_at ?? null,
    )
  }

  const sorted = alerts.sort((a, b) => {
    const urgencyOrder = { high: 0, moderate: 1, low: 2 }
    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
  })

  let alert_summary: string | null = null
  if (sorted.length === 0) {
    alert_summary = "No urgent operating changes detected"
  } else if (sorted[0]?.urgency === "high") {
    alert_summary = sorted[0].title
  } else {
    alert_summary = `${sorted.length} operating signal(s) — ${sorted[0]?.title ?? "review account"}`
  }

  return {
    qa_marker: GROWTH_REVENUE_OPERATING_ALERTS_QA_MARKER,
    alerts: sorted.slice(0, 8),
    alert_summary,
  }
}
