/** AI-assisted operator recommendations — deterministic, evidence-backed. Client-safe. */

import type { ProspectSearchAccountContactStrategy } from "@/lib/growth/prospect-search/prospect-search-account-contact-strategy"
import type { ProspectSearchAccountProgression } from "@/lib/growth/prospect-search/prospect-search-account-progression"
import type { ProspectSearchCompanyContactCoverageIntelligence } from "@/lib/growth/prospect-search/prospect-search-company-contact-coverage-intelligence"
import type { ProspectSearchContactInfluenceResult } from "@/lib/growth/prospect-search/prospect-search-contact-influence"
import type { ProspectSearchOrgIntelligence } from "@/lib/growth/prospect-search/prospect-search-org-intelligence"
import type { ProspectSearchOpportunityEmergence } from "@/lib/growth/prospect-search/prospect-search-opportunity-emergence"
import type { ProspectSearchOperatingAlertsSnapshot } from "@/lib/growth/prospect-search/prospect-search-revenue-operating-alerts"
import type { ProspectSearchRelationshipMemorySnapshot } from "@/lib/growth/prospect-search/prospect-search-relationship-memory"
import type { ProspectSearchSequenceReadiness } from "@/lib/growth/prospect-search/prospect-search-sequence-readiness"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthProspectSearchPeopleResultRow } from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import { resolveProspectSearchReachableHumanScore } from "@/lib/growth/prospect-search/prospect-search-reachable-human-scoring"
import { resolveProspectSearchOutreachReadinessGate } from "@/lib/growth/prospect-search/prospect-search-outreach-readiness-gate"

export const GROWTH_OPERATOR_RECOMMENDATIONS_QA_MARKER = "growth-operator-recommendations-v1" as const

export const PROSPECT_SEARCH_OPERATOR_RECOMMENDATION_TYPES = [
  "refresh_contacts",
  "research_operations_manager",
  "call_first",
  "email_first",
  "relationship_nurture",
  "escalate_to_owner",
  "avoid_outreach",
  "verification_required",
  "territory_priority",
  "coverage_gap_investigation",
  "sequence_review",
  "follow_up_recommended",
  "research_before_outreach",
  "identity_conflict_review",
  "contact_acquisition_required",
] as const

export type ProspectSearchOperatorRecommendationType =
  (typeof PROSPECT_SEARCH_OPERATOR_RECOMMENDATION_TYPES)[number]

export type ProspectSearchOperatorRecommendation = {
  id: string
  recommendation_type: ProspectSearchOperatorRecommendationType
  title: string
  confidence: number
  urgency: "low" | "moderate" | "high" | "critical"
  evidence: string[]
  reasoning: string[]
  recommended_operator_action: string
  recommended_timing: string
  risk_notes: string[]
  contributing_signals: string[]
  uncertainty_notes: string[]
  blocker_explanations: string[]
  priority_score: number
}

export type ProspectSearchOperatorRecommendationsSnapshot = {
  qa_marker: typeof GROWTH_OPERATOR_RECOMMENDATIONS_QA_MARKER
  recommendations: ProspectSearchOperatorRecommendation[]
  top_recommendation: ProspectSearchOperatorRecommendation | null
  summary: string | null
  evidence_backed: boolean
}

function urgencyRank(urgency: ProspectSearchOperatorRecommendation["urgency"]): number {
  if (urgency === "critical") return 4
  if (urgency === "high") return 3
  if (urgency === "moderate") return 2
  return 1
}

function pushRecommendation(
  list: ProspectSearchOperatorRecommendation[],
  rec: Omit<ProspectSearchOperatorRecommendation, "id" | "priority_score"> & {
    priority_score?: number
  },
): void {
  const priority_score =
    rec.priority_score ??
    Math.round(
      rec.confidence * 50 +
        urgencyRank(rec.urgency) * 12 +
        Math.min(20, rec.evidence.length * 4),
    )
  list.push({
    ...rec,
    id: `${rec.recommendation_type}:${rec.title.slice(0, 32)}`,
    priority_score,
  })
}

export function buildProspectSearchOperatorRecommendations(input: {
  company: GrowthProspectSearchCompanyResult
  peopleRows: GrowthProspectSearchPeopleResultRow[]
  coverage: ProspectSearchCompanyContactCoverageIntelligence
  accountStrategy: ProspectSearchAccountContactStrategy
  relationshipMemory?: ProspectSearchRelationshipMemorySnapshot | null
  accountProgression?: ProspectSearchAccountProgression | null
  opportunityEmergence?: ProspectSearchOpportunityEmergence | null
  sequenceReadiness?: ProspectSearchSequenceReadiness | null
  orgIntelligence?: ProspectSearchOrgIntelligence | null
  operatingAlerts?: ProspectSearchOperatingAlertsSnapshot | null
  contactInfluences?: ProspectSearchContactInfluenceResult[]
  territory_score?: number | null
  queue_priority_score?: number | null
}): ProspectSearchOperatorRecommendationsSnapshot {
  const recommendations: ProspectSearchOperatorRecommendation[] = []
  const {
    company,
    peopleRows,
    coverage,
    accountStrategy,
    relationshipMemory,
    accountProgression,
    opportunityEmergence,
    sequenceReadiness,
    orgIntelligence,
    operatingAlerts,
    contactInfluences,
    territory_score,
    queue_priority_score,
  } = input

  const outreachGate = resolveProspectSearchOutreachReadinessGate({
    company,
    reachable: company.reachable_human ?? undefined,
  })

  const staleCount = peopleRows.filter(
    (row) => row.freshness_status === "stale" || row.freshness_status === "expired",
  ).length
  const callReady = peopleRows.filter((row) => row.call_ready && row.call_eligibility === "eligible")
  const identityConflictRows = peopleRows.filter(
    (row) =>
      row.conflict_status &&
      row.conflict_status !== "no_conflict" &&
      row.conflict_status !== "likely_same_person",
  )
  const noReachableHumans =
    resolveProspectSearchReachableHumanScore(company).label === "no_reachable_humans" &&
    peopleRows.length === 0
  const topInfluence = [...(contactInfluences ?? [])].sort(
    (a, b) => b.influence_score - a.influence_score,
  )[0]

  if (company.is_suppressed || accountStrategy.account_outreach_readiness === "blocked") {
    pushRecommendation(recommendations, {
      recommendation_type: "avoid_outreach",
      title: "Avoid outreach — compliance block",
      confidence: 0.95,
      urgency: "critical",
      evidence: [company.suppression_reason ?? "Account or contact suppressed"],
      reasoning: ["Compliance block prevents coordinated outreach"],
      recommended_operator_action: "Resolve suppression before any outreach planning",
      recommended_timing: "Before any operator action",
      risk_notes: ["Outreach while blocked creates compliance risk"],
      contributing_signals: ["suppression", "account_strategy_blocked"],
      uncertainty_notes: [],
      blocker_explanations: accountStrategy.blocked_contacts.map(
        (c) => c.block_reason ?? "Blocked contact",
      ),
    })
  }

  if (staleCount > 0) {
    pushRecommendation(recommendations, {
      recommendation_type: "refresh_contacts",
      title: "Refresh stale contacts",
      confidence: Math.min(0.9, 0.55 + staleCount * 0.1),
      urgency: staleCount >= peopleRows.length / 2 ? "high" : "moderate",
      evidence: [`${staleCount} contact(s) with stale or expired verification`],
      reasoning: ["Verification freshness affects outreach eligibility and sequence readiness"],
      recommended_operator_action: "Run contact verification refresh on stale contacts",
      recommended_timing: "Before outreach or sequencing",
      risk_notes: ["Outreach on stale contacts may fail compliance checks"],
      contributing_signals: ["freshness_state"],
      uncertainty_notes: [],
      blocker_explanations: [],
      priority_score: 55 + staleCount * 5,
    })
  }

  if (
    accountStrategy.missing_personas.includes("operations_manager") ||
    !orgIntelligence?.operations_coverage
  ) {
    pushRecommendation(recommendations, {
      recommendation_type: "research_operations_manager",
      title: "Research Operations Manager persona",
      confidence: 0.72,
      urgency: "moderate",
      evidence: [
        ...(accountStrategy.missing_personas.includes("operations_manager")
          ? ["Operations Manager missing from account strategy"]
          : []),
        ...(orgIntelligence && !orgIntelligence.operations_coverage
          ? ["Org intelligence shows no operations coverage"]
          : []),
      ],
      reasoning: ["Operational buyer persona improves outreach quality for equipment accounts"],
      recommended_operator_action: "Run contact discovery focused on operations leadership",
      recommended_timing: "Before first outreach push",
      risk_notes: [],
      contributing_signals: ["missing_personas", "org_intelligence"],
      uncertainty_notes: ["Persona may exist under alternate title — verify manually"],
      blocker_explanations: [],
    })
  }

  if (coverage.persona_completeness < 40 || peopleRows.length === 0) {
    pushRecommendation(recommendations, {
      recommendation_type: "research_before_outreach",
      title: "Research before outreach",
      confidence: 0.78,
      urgency: "high",
      evidence: [
        peopleRows.length === 0
          ? "No contacts discovered on account"
          : `Persona completeness ${coverage.persona_completeness}%`,
      ],
      reasoning: ["Insufficient operational coverage for confident outreach"],
      recommended_operator_action:
        accountStrategy.contact_research_next_step ?? "Complete contact research workflow",
      recommended_timing: "Now — before queue or sequence actions",
      risk_notes: ["Premature outreach wastes operator time on weak accounts"],
      contributing_signals: ["coverage_gaps"],
      uncertainty_notes: [],
      blocker_explanations: sequenceReadiness?.missing_requirements ?? [],
    })
  }

  if (noReachableHumans) {
    pushRecommendation(recommendations, {
      recommendation_type: "contact_acquisition_required",
      title: "Contact acquisition required — no reachable humans",
      confidence: 0.88,
      urgency: "high",
      evidence: outreachGate?.blockers?.length
        ? outreachGate.blockers
        : ["No verified contacts on account"],
      reasoning: [
        "Contact-first policy blocks sequence and outreach execution until humans are discoverable",
        "Run focused website contact acquisition before deep intelligence expansion",
      ],
      recommended_operator_action: "Find contacts on this account (team, leadership, contact pages)",
      recommended_timing: "Now — before queue, pipeline, or sequence actions",
      risk_notes: ["Deep intelligence without contacts wastes compute and blocks execution"],
      contributing_signals: ["reachable_human_score", "contact_first_policy"],
      uncertainty_notes: [],
      blocker_explanations: [],
      priority_score: 72,
    })
  }

  if (identityConflictRows.length > 0) {
    pushRecommendation(recommendations, {
      recommendation_type: "identity_conflict_review",
      title: "Contact identity conflict needs review",
      confidence: Math.min(0.92, 0.6 + identityConflictRows.length * 0.08),
      urgency: identityConflictRows.some((row) => row.conflict_status === "channel_conflict")
        ? "high"
        : "moderate",
      evidence: identityConflictRows.slice(0, 3).map((row) => {
        const label = row.full_name?.trim() || "Contact"
        return `${label}: ${row.conflict_status?.replace(/_/g, " ") ?? "conflict"}`
      }),
      reasoning: [
        "Unresolved identity conflicts may attach channels to the wrong person",
        "Review merged evidence before outreach or queue handoff",
      ],
      recommended_operator_action:
        "Open evidence drawer and confirm same person, keep separate, or mark channel as role/shared",
      recommended_timing: "Before outreach, queue push, or Lead Pipeline handoff",
      risk_notes: ["Outreach on conflicted contacts may reach the wrong person or shared inbox"],
      contributing_signals: ["identity_resolution", "conflict_status"],
      uncertainty_notes: identityConflictRows
        .filter((row) => !row.operator_confirmed)
        .slice(0, 2)
        .map((row) => `${row.full_name ?? "Contact"} not operator-confirmed`),
      blocker_explanations: [],
      priority_score: 60 + identityConflictRows.length * 8,
    })
  }

  if (sequenceReadiness?.readiness_state === "verification_required") {
    pushRecommendation(recommendations, {
      recommendation_type: "verification_required",
      title: "Verification required before sequencing",
      confidence: 0.82,
      urgency: "high",
      evidence: sequenceReadiness.blockers.slice(0, 2),
      reasoning: sequenceReadiness.readiness_reasons.slice(0, 2),
      recommended_operator_action: "Refresh verification on primary and secondary contacts",
      recommended_timing: "Before enrolling in any sequence",
      risk_notes: [],
      contributing_signals: ["sequence_readiness", "freshness_state"],
      uncertainty_notes: [],
      blocker_explanations: sequenceReadiness.blockers,
    })
  }

  if (
    sequenceReadiness?.readiness_state === "ready" &&
    sequenceReadiness.sequence_suitability === "call_first" &&
    callReady.length > 0
  ) {
    pushRecommendation(recommendations, {
      recommendation_type: "call_first",
      title: "Call-first outreach recommended",
      confidence: Math.min(0.92, sequenceReadiness.readiness_score / 100 + 0.15),
      urgency: opportunityEmergence?.urgency_level === "high" ? "high" : "moderate",
      evidence: [
        `${callReady.length} call-ready eligible contact(s)`,
        ...sequenceReadiness.readiness_reasons.slice(0, 2),
      ],
      reasoning: [
        "Sequence readiness supports call-first coordinated outreach",
        ...(opportunityEmergence?.emergence_reasons.slice(0, 1) ?? []),
      ],
      recommended_operator_action: sequenceReadiness.suggested_sequence_type,
      recommended_timing: "When operator is ready to place first touch",
      risk_notes: sequenceReadiness.blockers,
      contributing_signals: ["sequence_readiness", "call_eligibility", "opportunity_emergence"],
      uncertainty_notes: [],
      blocker_explanations: [],
      priority_score: 70 + (opportunityEmergence?.emergence_score ?? 0) / 5,
    })
  } else if (
    sequenceReadiness?.readiness_state === "ready" &&
    sequenceReadiness.sequence_suitability === "email_first"
  ) {
    pushRecommendation(recommendations, {
      recommendation_type: "email_first",
      title: "Email-first outreach recommended",
      confidence: Math.min(0.88, sequenceReadiness.readiness_score / 100 + 0.1),
      urgency: "moderate",
      evidence: sequenceReadiness.readiness_reasons.slice(0, 3),
      reasoning: ["Email channel eligible with verified contacts"],
      recommended_operator_action: sequenceReadiness.suggested_sequence_type,
      recommended_timing: "After operator review of primary contact",
      risk_notes: [],
      contributing_signals: ["sequence_readiness", "email_eligibility"],
      uncertainty_notes: [],
      blocker_explanations: [],
    })
  }

  if (
    sequenceReadiness?.sequence_suitability === "relationship_nurture" ||
    relationshipMemory?.relationship_status === "warming"
  ) {
    pushRecommendation(recommendations, {
      recommendation_type: "relationship_nurture",
      title: "Relationship nurture before hard outreach",
      confidence: 0.74,
      urgency: "moderate",
      evidence: [
        ...(relationshipMemory?.strength_reasons.slice(0, 2) ?? []),
        ...(relationshipMemory?.recommended_next_action
          ? [relationshipMemory.recommended_next_action]
          : []),
      ],
      reasoning: ["Relationship is warming — nurture sequence appropriate"],
      recommended_operator_action:
        relationshipMemory?.recommended_next_action ??
        "Continue warming with highest-influence reachable contact",
      recommended_timing: "Over next 1–2 weeks",
      risk_notes: ["Hard outreach may cool a warming relationship"],
      contributing_signals: ["relationship_memory", "progression_state"],
      uncertainty_notes: [],
      blocker_explanations: [],
    })
  }

  if (
    topInfluence?.persona_type === "owner" ||
    accountStrategy.primary_contact?.persona_type === "owner"
  ) {
    pushRecommendation(recommendations, {
      recommendation_type: "escalate_to_owner",
      title: "Owner persona identified — review escalation path",
      confidence: 0.68,
      urgency: "moderate",
      evidence: topInfluence?.influence_reasons.slice(0, 2) ?? ["Owner persona on account"],
      reasoning: ["Decision-maker contact may warrant operator review before outreach"],
      recommended_operator_action: "Review owner contact in account strategy before first touch",
      recommended_timing: "Before primary outreach if operations path unavailable",
      risk_notes: [],
      contributing_signals: ["influence_scoring", "persona_type"],
      uncertainty_notes: ["Owner may not be operational buyer — confirm fit"],
      blocker_explanations: [],
    })
  }

  if ((territory_score ?? 0) >= 70) {
    pushRecommendation(recommendations, {
      recommendation_type: "territory_priority",
      title: "Territory priority account",
      confidence: 0.7,
      urgency: "moderate",
      evidence: [`Territory opportunity score ${territory_score}`],
      reasoning: ["Account sits in elevated territory opportunity cluster"],
      recommended_operator_action: "Prioritize in territory-focused outreach workflow",
      recommended_timing: "This week",
      risk_notes: [],
      contributing_signals: ["territory_intelligence"],
      uncertainty_notes: [],
      blocker_explanations: [],
    })
  }

  if (
    opportunityEmergence?.emergence_tier === "accelerating" ||
    opportunityEmergence?.emergence_tier === "outreach_ready"
  ) {
    pushRecommendation(recommendations, {
      recommendation_type: "sequence_review",
      title: "Sequence review — opportunity accelerating",
      confidence: Math.min(0.9, (opportunityEmergence.emergence_score ?? 0) / 100 + 0.2),
      urgency: opportunityEmergence.urgency_level === "high" ? "high" : "moderate",
      evidence: opportunityEmergence.emergence_reasons.slice(0, 3),
      reasoning: [opportunityEmergence.recommended_next_action],
      recommended_operator_action: "Operator review for coordinated outreach",
      recommended_timing: "Soon — while momentum signals are fresh",
      risk_notes: opportunityEmergence.opportunity_risks,
      contributing_signals: ["opportunity_emergence", "progression_state"],
      uncertainty_notes: [],
      blocker_explanations: [],
      priority_score: 65 + (opportunityEmergence.emergence_score ?? 0) / 4,
    })
  }

  if (
    accountProgression?.progression_state === "stalled" ||
    relationshipMemory?.relationship_status === "stalled"
  ) {
    pushRecommendation(recommendations, {
      recommendation_type: "follow_up_recommended",
      title: "Follow-up recommended — account stalled",
      confidence: 0.65,
      urgency: "moderate",
      evidence: accountProgression?.progression_reasons.slice(0, 2) ?? ["Relationship stalled"],
      reasoning: [
        accountProgression?.next_best_action ?? "Refresh contacts and review relationship timeline",
      ],
      recommended_operator_action: "Review timeline before re-engaging",
      recommended_timing: "After contact refresh",
      risk_notes: ["Repeated outreach without refresh may reduce response rates"],
      contributing_signals: ["account_progression", "relationship_memory"],
      uncertainty_notes: [],
      blocker_explanations: accountProgression?.progression_blockers ?? [],
    })
  }

  if (coverage.persona_completeness < 55 && peopleRows.length > 0) {
    pushRecommendation(recommendations, {
      recommendation_type: "coverage_gap_investigation",
      title: "Coverage gap investigation",
      confidence: 0.66,
      urgency: "moderate",
      evidence: [
        `Persona completeness ${coverage.persona_completeness}%`,
        ...coverage.persona_gap_suggestions.slice(0, 2),
      ],
      reasoning: ["Operational coverage gaps limit outreach effectiveness"],
      recommended_operator_action: "Investigate missing personas before scaling outreach",
      recommended_timing: "Before bulk queue actions",
      risk_notes: [],
      contributing_signals: ["coverage_intelligence"],
      uncertainty_notes: [],
      blocker_explanations: accountStrategy.missing_personas.map((p) => p.replace(/_/g, " ")),
    })
  }

  for (const alert of operatingAlerts?.alerts.slice(0, 2) ?? []) {
    if (alert.urgency !== "high") continue
    pushRecommendation(recommendations, {
      recommendation_type: "follow_up_recommended",
      title: alert.title,
      confidence: 0.75,
      urgency: "high",
      evidence: alert.evidence.slice(0, 2),
      reasoning: [alert.detail],
      recommended_operator_action: alert.suggested_action,
      recommended_timing: "Today",
      risk_notes: [],
      contributing_signals: ["operating_alerts", alert.kind],
      uncertainty_notes: [],
      blocker_explanations: [],
      priority_score: 80,
    })
  }

  const sorted = recommendations.sort((a, b) => b.priority_score - a.priority_score)
  const top = sorted[0] ?? null

  let summary: string | null = null
  if (top) {
    summary =
      top.urgency === "high" || top.urgency === "critical"
        ? `High priority: ${top.title}`
        : top.recommended_operator_action
  }

  if ((queue_priority_score ?? accountStrategy.queue_priority_score) >= 75 && top) {
    summary = `${summary ?? top.title} · Queue priority elevated (${queue_priority_score ?? accountStrategy.queue_priority_score})`
  }

  return {
    qa_marker: GROWTH_OPERATOR_RECOMMENDATIONS_QA_MARKER,
    recommendations: sorted.slice(0, 8),
    top_recommendation: top,
    summary,
    evidence_backed: sorted.some((rec) => rec.evidence.length > 0),
  }
}

export function resolveOperatorRecommendationQueueBoost(
  snapshot: ProspectSearchOperatorRecommendationsSnapshot | null | undefined,
): number {
  const top = snapshot?.top_recommendation
  if (!top) return 0
  if (top.recommendation_type === "avoid_outreach") return -8
  if (top.urgency === "critical") return 6
  if (top.urgency === "high" && top.confidence >= 0.7) return 4
  if (top.recommendation_type === "call_first" || top.recommendation_type === "sequence_review") {
    return 3
  }
  if (top.recommendation_type === "research_before_outreach") return -3
  return 0
}
