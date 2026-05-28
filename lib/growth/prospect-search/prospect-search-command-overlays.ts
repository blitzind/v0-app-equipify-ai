/** Prospect Search command overlays + recommended work views. Client-safe. */

import type { ProspectSearchAccountContactStrategy } from "@/lib/growth/prospect-search/prospect-search-account-contact-strategy"
import type { ProspectSearchAccountProgression } from "@/lib/growth/prospect-search/prospect-search-account-progression"
import type { ProspectSearchAdaptiveRefreshSnapshot } from "@/lib/growth/prospect-search/prospect-search-adaptive-refresh"
import type { ProspectSearchOpportunityEmergence } from "@/lib/growth/prospect-search/prospect-search-opportunity-emergence"
import type { ProspectSearchRelationshipMemorySnapshot } from "@/lib/growth/prospect-search/prospect-search-relationship-memory"
import type { ProspectSearchResearchGapsSnapshot } from "@/lib/growth/prospect-search/prospect-search-research-gaps"
import type { ProspectSearchSequenceReadiness } from "@/lib/growth/prospect-search/prospect-search-sequence-readiness"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_PROSPECT_COMMAND_OVERLAYS_QA_MARKER = "growth-prospect-command-overlays-v1" as const

export const PROSPECT_SEARCH_COMMAND_OVERLAY_KINDS = [
  "sequence_ready",
  "emerging_opportunity",
  "relationship_warming",
  "research_needed",
  "territory_hotspot",
  "stalled",
  "blocked_suppressed",
  "refresh_recommended",
] as const

export type ProspectSearchCommandOverlayKind =
  (typeof PROSPECT_SEARCH_COMMAND_OVERLAY_KINDS)[number]

export type ProspectSearchCommandOverlay = {
  kind: ProspectSearchCommandOverlayKind
  label: string
  urgency: "low" | "moderate" | "high"
  evidence: string[]
}

export type ProspectSearchRecommendedWorkView = {
  id: string
  label: string
  description: string
  filter_hint: string
  company_count: number
  evidence_summary: string
}

export type ProspectSearchCommandOverlaysSnapshot = {
  qa_marker: typeof GROWTH_PROSPECT_COMMAND_OVERLAYS_QA_MARKER
  overlays: ProspectSearchCommandOverlay[]
  recommended_work_views: ProspectSearchRecommendedWorkView[]
  primary_overlay: ProspectSearchCommandOverlay | null
}

export function resolveProspectSearchCommandOverlays(input: {
  company: GrowthProspectSearchCompanyResult
  researchGaps?: ProspectSearchResearchGapsSnapshot | null
  adaptiveRefresh?: ProspectSearchAdaptiveRefreshSnapshot | null
  territory_score?: number | null
  sequenceReadiness?: ProspectSearchSequenceReadiness | null
  opportunityEmergence?: ProspectSearchOpportunityEmergence | null
  relationshipMemory?: ProspectSearchRelationshipMemorySnapshot | null
  accountProgression?: ProspectSearchAccountProgression | null
  accountStrategy?: ProspectSearchAccountContactStrategy | null
}): ProspectSearchCommandOverlaysSnapshot {
  const overlays: ProspectSearchCommandOverlay[] = []
  const intelligence = input.company.contact_intelligence
  const sequence = input.sequenceReadiness ?? intelligence?.sequence_readiness
  const emergence = input.opportunityEmergence ?? intelligence?.opportunity_emergence
  const relationship = input.relationshipMemory ?? intelligence?.relationship_memory
  const accountProgression = input.accountProgression ?? intelligence?.account_progression
  const accountStrategy = input.accountStrategy ?? intelligence?.account_contact_strategy

  if (input.company.is_suppressed) {
    overlays.push({
      kind: "blocked_suppressed",
      label: "Blocked",
      urgency: "high",
      evidence: [input.company.suppression_reason ?? "Suppressed"],
    })
  }

  if (
    sequence?.readiness_state === "ready" ||
    sequence?.readiness_state === "ready_with_review"
  ) {
    overlays.push({
      kind: "sequence_ready",
      label: "Sequence ready",
      urgency: sequence.readiness_state === "ready" ? "high" : "moderate",
      evidence: sequence.readiness_reasons.slice(0, 2),
    })
  }

  if (
    emergence?.emergence_tier === "emerging" ||
    emergence?.emergence_tier === "accelerating" ||
    emergence?.emergence_tier === "outreach_ready"
  ) {
    overlays.push({
      kind: "emerging_opportunity",
      label: emergence.emergence_tier.replace(/_/g, " "),
      urgency: emergence.urgency_level === "high" ? "high" : "moderate",
      evidence: emergence.emergence_reasons.slice(0, 2),
    })
  }

  if (relationship?.relationship_status === "warming") {
    overlays.push({
      kind: "relationship_warming",
      label: "Relationship warming",
      urgency: "moderate",
      evidence: relationship.strength_reasons.slice(0, 2),
    })
  }

  if (
    (input.researchGaps?.tasks.length ?? 0) >= 2 ||
    accountStrategy?.account_outreach_readiness === "research_needed"
  ) {
    overlays.push({
      kind: "research_needed",
      label: "Research needed",
      urgency: "moderate",
      evidence: input.researchGaps?.tasks.slice(0, 2).map((t) => t.label) ?? ["Research required"],
    })
  }

  if ((input.territory_score ?? 0) >= 70) {
    overlays.push({
      kind: "territory_hotspot",
      label: "Territory hotspot",
      urgency: "moderate",
      evidence: [`Territory score ${input.territory_score}`],
    })
  }

  if (
    accountProgression?.progression_state === "stalled" ||
    relationship?.relationship_status === "stalled"
  ) {
    overlays.push({
      kind: "stalled",
      label: "Stalled",
      urgency: "moderate",
      evidence: accountProgression?.progression_reasons.slice(0, 1) ?? ["Stalled"],
    })
  }

  if (input.adaptiveRefresh?.refresh_recommended) {
    overlays.push({
      kind: "refresh_recommended",
      label: "Refresh recommended",
      urgency: input.adaptiveRefresh.refresh_urgency,
      evidence: input.adaptiveRefresh.refresh_reasons.slice(0, 2),
    })
  }

  const urgencyOrder = { high: 0, moderate: 1, low: 2 }
  overlays.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])

  return {
    qa_marker: GROWTH_PROSPECT_COMMAND_OVERLAYS_QA_MARKER,
    overlays: overlays.slice(0, 6),
    recommended_work_views: [],
    primary_overlay: overlays[0] ?? null,
  }
}

export function buildProspectSearchRecommendedWorkViews(input: {
  companies: GrowthProspectSearchCompanyResult[]
}): ProspectSearchRecommendedWorkView[] {
  const views: ProspectSearchRecommendedWorkView[] = []

  const callToday = input.companies.filter((company) => {
    const seq = company.contact_intelligence?.sequence_readiness
    return seq?.sequence_suitability === "call_first" && seq.readiness_state === "ready"
  })
  if (callToday.length > 0) {
    views.push({
      id: "best_call_today",
      label: "Best accounts to call today",
      description: "Call-first sequence-ready accounts with verified call-ready contacts",
      filter_hint: "sequence_ready + call_first",
      company_count: callToday.length,
      evidence_summary: `${callToday.length} account(s) with call-first readiness`,
    })
  }

  const researchFirst = input.companies.filter(
    (company) =>
      (company.contact_intelligence?.operator_assist?.research_gaps.tasks.length ?? 0) > 0 ||
      company.contact_intelligence?.account_contact_strategy?.account_outreach_readiness ===
        "research_needed",
  )
  if (researchFirst.length > 0) {
    views.push({
      id: "research_before_outreach",
      label: "Research before outreach",
      description: "Accounts with coverage or persona gaps blocking outreach",
      filter_hint: "research_needed",
      company_count: researchFirst.length,
      evidence_summary: `${researchFirst.length} account(s) need research before outreach`,
    })
  }

  const territoryHeating = input.companies.filter(
    (company) =>
      company.contact_intelligence?.opportunity_emergence?.emergence_tier === "accelerating" ||
      company.contact_intelligence?.command_overlays?.overlays.some(
        (overlay) => overlay.kind === "territory_hotspot",
      ),
  )
  if (territoryHeating.length > 0) {
    views.push({
      id: "territories_heating_up",
      label: "Territories heating up",
      description: "Accounts with accelerating opportunities or territory hotspots",
      filter_hint: "emerging_opportunity",
      company_count: territoryHeating.length,
      evidence_summary: `${territoryHeating.length} account(s) with elevated territory/opportunity signals`,
    })
  }

  const verificationNeeded = input.companies.filter(
    (company) =>
      company.contact_intelligence?.sequence_readiness?.readiness_state === "verification_required" ||
      company.contact_intelligence?.operator_assist?.adaptive_refresh.refresh_recommended === true,
  )
  if (verificationNeeded.length > 0) {
    views.push({
      id: "verification_needed",
      label: "Accounts needing verification",
      description: "Stale verification or refresh recommended before outreach",
      filter_hint: "verification_required",
      company_count: verificationNeeded.length,
      evidence_summary: `${verificationNeeded.length} account(s) need verification refresh`,
    })
  }

  const warming = input.companies.filter(
    (company) =>
      company.contact_intelligence?.relationship_memory?.relationship_status === "warming",
  )
  if (warming.length > 0) {
    views.push({
      id: "relationship_warming",
      label: "Relationship warming opportunities",
      description: "Accounts with strengthening relationship signals",
      filter_hint: "relationship_warming",
      company_count: warming.length,
      evidence_summary: `${warming.length} account(s) with warming relationships`,
    })
  }

  return views
}

export function companyMatchesCommandOverlayFilter(
  company: GrowthProspectSearchCompanyResult,
  filterId: string,
): boolean {
  const intelligence = company.contact_intelligence
  switch (filterId) {
    case "best_call_today":
      return (
        intelligence?.sequence_readiness?.sequence_suitability === "call_first" &&
        intelligence?.sequence_readiness?.readiness_state === "ready"
      )
    case "research_before_outreach":
      return (
        intelligence?.account_contact_strategy?.account_outreach_readiness === "research_needed" ||
        (intelligence?.operator_assist?.research_gaps.tasks.length ?? 0) > 0
      )
    case "territories_heating_up":
      return (
        intelligence?.opportunity_emergence?.emergence_tier === "accelerating" ||
        intelligence?.command_overlays?.overlays.some((o) => o.kind === "territory_hotspot") === true
      )
    case "verification_needed":
      return (
        intelligence?.sequence_readiness?.readiness_state === "verification_required" ||
        intelligence?.operator_assist?.adaptive_refresh.refresh_recommended === true
      )
    case "relationship_warming":
      return intelligence?.relationship_memory?.relationship_status === "warming"
    default:
      return true
  }
}
