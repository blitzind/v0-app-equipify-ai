/** Opportunity emergence detection — timeline-derived, evidence-backed. Client-safe. */

import type { ProspectSearchAccountProgression } from "@/lib/growth/prospect-search/prospect-search-account-progression"
import type { ProspectSearchAccountTimeline } from "@/lib/growth/prospect-search/prospect-search-account-timeline"
import type { ProspectSearchCompanyContactCoverageIntelligence } from "@/lib/growth/prospect-search/prospect-search-company-contact-coverage-intelligence"
import type { ProspectSearchRelationshipMemorySnapshot } from "@/lib/growth/prospect-search/prospect-search-relationship-memory"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthProspectSearchPeopleResultRow } from "@/lib/growth/prospect-search/prospect-search-contact-discovery"

export const GROWTH_OPPORTUNITY_EMERGENCE_QA_MARKER = "growth-opportunity-emergence-v1" as const

export const PROSPECT_SEARCH_OPPORTUNITY_STATES = [
  "emerging",
  "accelerating",
  "outreach_ready",
  "relationship_building",
  "expansion_opportunity",
  "stalled",
  "cooling",
  "blocked",
] as const

export type ProspectSearchOpportunityState = (typeof PROSPECT_SEARCH_OPPORTUNITY_STATES)[number]

export const PROSPECT_SEARCH_OPPORTUNITY_TRENDS = [
  "improving",
  "stable",
  "declining",
  "blocked",
] as const

export type ProspectSearchOpportunityTrend = (typeof PROSPECT_SEARCH_OPPORTUNITY_TRENDS)[number]

export const PROSPECT_SEARCH_OPPORTUNITY_URGENCY = ["low", "moderate", "high", "critical"] as const
export type ProspectSearchOpportunityUrgency = (typeof PROSPECT_SEARCH_OPPORTUNITY_URGENCY)[number]

export type ProspectSearchOpportunityEmergence = {
  qa_marker: typeof GROWTH_OPPORTUNITY_EMERGENCE_QA_MARKER
  emergence_score: number
  emergence_tier: ProspectSearchOpportunityState
  opportunity_trend: ProspectSearchOpportunityTrend
  emergence_reasons: string[]
  opportunity_risks: string[]
  recommended_next_action: string
  urgency_level: ProspectSearchOpportunityUrgency
  evidence_backed: boolean
}

export function detectProspectSearchOpportunityEmergence(input: {
  company: GrowthProspectSearchCompanyResult
  peopleRows: GrowthProspectSearchPeopleResultRow[]
  coverage: ProspectSearchCompanyContactCoverageIntelligence
  relationshipMemory?: ProspectSearchRelationshipMemorySnapshot | null
  accountProgression?: ProspectSearchAccountProgression | null
  accountTimeline?: ProspectSearchAccountTimeline | null
  territory_score?: number | null
}): ProspectSearchOpportunityEmergence {
  const emergence_reasons: string[] = []
  const opportunity_risks: string[] = []
  let score = 0

  const {
    company,
    peopleRows,
    coverage,
    relationshipMemory,
    accountProgression,
    accountTimeline,
    territory_score,
  } = input

  if (company.is_suppressed || relationshipMemory?.relationship_status === "blocked") {
    return {
      qa_marker: GROWTH_OPPORTUNITY_EMERGENCE_QA_MARKER,
      emergence_score: 0,
      emergence_tier: "blocked",
      opportunity_trend: "blocked",
      emergence_reasons: ["Account blocked by compliance"],
      opportunity_risks: ["Outreach blocked — resolve suppression first"],
      recommended_next_action: "Resolve compliance block before opportunity assessment",
      urgency_level: "critical",
      evidence_backed: true,
    }
  }

  const freshContacts = peopleRows.filter((row) => row.freshness_status === "fresh").length
  const callReadyContacts = peopleRows.filter((row) => row.call_ready).length
  const recentDiscoveries = peopleRows.filter((row) =>
    row.timeline_events.some((e) => e.kind === "discovered"),
  ).length
  const operationalPersonas = peopleRows.filter(
    (row) =>
      row.persona_type === "operations_manager" ||
      row.persona_type === "service_manager" ||
      row.persona_type === "owner",
  ).length

  if (recentDiscoveries > 0 || peopleRows.length > 0) {
    score += Math.min(15, peopleRows.length * 3)
    if (recentDiscoveries > 0) {
      emergence_reasons.push("New contact discovery on account timeline")
    }
  }
  if (operationalPersonas > 0) {
    score += Math.min(12, operationalPersonas * 4)
    emergence_reasons.push("Operational buyer personas identified")
  }
  if (freshContacts > 0) {
    score += Math.min(10, freshContacts * 3)
    emergence_reasons.push(`${freshContacts} fresh verified contact(s)`)
  }
  if (callReadyContacts > 0) {
    score += Math.min(12, callReadyContacts * 4)
    emergence_reasons.push(`${callReadyContacts} call-ready contact(s)`)
  }
  if (coverage.persona_completeness >= 60) {
    score += 8
    emergence_reasons.push(`Persona coverage ${coverage.persona_completeness}%`)
  } else if (coverage.persona_completeness < 35) {
    opportunity_risks.push("Weak operational persona coverage")
    score -= 6
  }
  if (coverage.outreach_readiness_score >= 70) {
    score += 10
    emergence_reasons.push("Strong outreach readiness score")
  }

  if (relationshipMemory?.momentum_direction === "strengthening") {
    score += 14
    emergence_reasons.push("Relationship momentum strengthening")
  } else if (relationshipMemory?.momentum_direction === "weakening") {
    score -= 12
    opportunity_risks.push("Relationship momentum weakening")
  }
  if (relationshipMemory?.relationship_status === "warming") {
    score += 8
    emergence_reasons.push("Warming relationship from observed engagement")
  } else if (
    relationshipMemory?.relationship_status === "engaged" ||
    relationshipMemory?.relationship_status === "active"
  ) {
    score += 12
    emergence_reasons.push("Active engagement on relationship timeline")
  } else if (relationshipMemory?.relationship_status === "stalled") {
    score -= 10
    opportunity_risks.push("Relationship stalled — re-engage carefully")
  }

  if (accountProgression?.progression_state === "outreach_ready") {
    score += 10
    emergence_reasons.push("Account progression at outreach-ready state")
  } else if (accountProgression?.progression_state === "warming") {
    score += 6
  } else if (accountProgression?.progression_state === "stalled") {
    score -= 8
    opportunity_risks.push("Account progression stalled")
  }

  const recentOutreach = accountTimeline?.recent_outreach_count ?? 0
  const timelineDensity = accountTimeline?.events.length ?? 0
  if (timelineDensity >= 4) {
    score += Math.min(8, timelineDensity)
    emergence_reasons.push("Accelerating timeline activity")
  }
  if (relationshipMemory?.prior_reply_count) {
    score += Math.min(15, relationshipMemory.prior_reply_count * 6)
    emergence_reasons.push("Recent reply activity recorded")
  }
  if (recentOutreach >= 3 && !relationshipMemory?.prior_reply_count) {
    opportunity_risks.push("Multiple outreach attempts without recorded response")
    score -= 5
  }

  if (company.existing_customer) {
    score += 6
    emergence_reasons.push("Expansion opportunity — existing customer account")
  }
  if (company.in_lead_inbox) {
    score += 4
  }
  if (territory_score != null && territory_score >= 70) {
    score += 6
    emergence_reasons.push("Territory opportunity concentration elevated")
  }

  score = Math.round(Math.min(100, Math.max(0, score)))

  let emergence_tier: ProspectSearchOpportunityState = "emerging"
  if (score >= 75 && callReadyContacts > 0 && coverage.outreach_readiness_score >= 65) {
    emergence_tier = "accelerating"
  } else if (score >= 65 && accountProgression?.progression_state === "outreach_ready") {
    emergence_tier = "outreach_ready"
  } else if (company.existing_customer && score >= 50) {
    emergence_tier = "expansion_opportunity"
  } else if (relationshipMemory?.relationship_status === "warming" && score >= 40) {
    emergence_tier = "relationship_building"
  } else if (relationshipMemory?.relationship_status === "stalled" || score < 25) {
    emergence_tier = score < 15 ? "cooling" : "stalled"
  } else if (score >= 35) {
    emergence_tier = "emerging"
  } else {
    emergence_tier = "cooling"
  }

  let opportunity_trend: ProspectSearchOpportunityTrend = "stable"
  if (relationshipMemory?.momentum_direction === "strengthening" || score >= 60) {
    opportunity_trend = "improving"
  } else if (relationshipMemory?.momentum_direction === "weakening" || score < 30) {
    opportunity_trend = "declining"
  }

  let urgency_level: ProspectSearchOpportunityUrgency = "low"
  if (emergence_tier === "accelerating" || emergence_tier === "outreach_ready") {
    urgency_level = "high"
  } else if (emergence_tier === "emerging" || emergence_tier === "relationship_building") {
    urgency_level = "moderate"
  } else if (emergence_tier === "blocked") {
    urgency_level = "critical"
  }

  let recommended_next_action = "Continue contact research before assessing opportunity"
  if (emergence_tier === "accelerating") {
    recommended_next_action = "Review sequence readiness — account showing accelerating operational signals"
  } else if (emergence_tier === "outreach_ready") {
    recommended_next_action = "Operator review for coordinated outreach — evidence supports readiness"
  } else if (emergence_tier === "relationship_building") {
    recommended_next_action = "Continue warming with highest-influence reachable contact"
  } else if (emergence_tier === "expansion_opportunity") {
    recommended_next_action = "Review expansion path — existing customer with emerging signals"
  } else if (emergence_tier === "cooling" || emergence_tier === "stalled") {
    recommended_next_action = "Research first — refresh contacts before re-engaging cooled account"
  } else if (coverage.persona_completeness < 40) {
    recommended_next_action = "Research first — insufficient operational coverage for outreach"
  } else if (emergence_tier === "emerging") {
    recommended_next_action = "Monitor emerging signals — verify contacts before outreach push"
  }

  const evidence_backed =
    emergence_reasons.length > 0 &&
    (Boolean(relationshipMemory?.evidence_backed) ||
      peopleRows.length > 0 ||
      (accountTimeline?.events.length ?? 0) > 0)

  return {
    qa_marker: GROWTH_OPPORTUNITY_EMERGENCE_QA_MARKER,
    emergence_score: score,
    emergence_tier,
    opportunity_trend,
    emergence_reasons: emergence_reasons.slice(0, 6),
    opportunity_risks: opportunity_risks.slice(0, 4),
    recommended_next_action,
    urgency_level,
    evidence_backed,
  }
}

export function resolveOpportunityQueueBoost(
  emergence: ProspectSearchOpportunityEmergence | null | undefined,
): number {
  if (!emergence || emergence.emergence_tier === "blocked") return 0
  if (emergence.emergence_tier === "accelerating" || emergence.emergence_tier === "outreach_ready") {
    return 7
  }
  if (emergence.emergence_tier === "emerging" || emergence.emergence_tier === "relationship_building") {
    return 4
  }
  if (emergence.emergence_tier === "expansion_opportunity") return 5
  if (emergence.emergence_tier === "cooling" || emergence.emergence_tier === "stalled") return -5
  if (emergence.opportunity_trend === "improving") return 2
  if (emergence.opportunity_trend === "declining") return -3
  return 0
}
