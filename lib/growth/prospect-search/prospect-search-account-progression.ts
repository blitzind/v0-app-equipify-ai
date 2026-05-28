/** Account progression engine for Prospect Search — event-driven, explainable. Client-safe. */

import type { ProspectSearchAccountContactStrategy } from "@/lib/growth/prospect-search/prospect-search-account-contact-strategy"
import type { ProspectSearchCompanyContactCoverageIntelligence } from "@/lib/growth/prospect-search/prospect-search-company-contact-coverage-intelligence"
import type { ProspectSearchAccountTimeline } from "@/lib/growth/prospect-search/prospect-search-account-timeline"
import type { ProspectSearchRelationshipMemorySnapshot } from "@/lib/growth/prospect-search/prospect-search-relationship-memory"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_ACCOUNT_PROGRESSION_QA_MARKER = "growth-account-progression-v1" as const

export const PROSPECT_SEARCH_ACCOUNT_PROGRESSION_STATES = [
  "discovered",
  "researching",
  "outreach_ready",
  "warming",
  "engaged",
  "progressing",
  "stalled",
  "blocked",
  "inactive",
] as const

export type ProspectSearchAccountProgressionState =
  (typeof PROSPECT_SEARCH_ACCOUNT_PROGRESSION_STATES)[number]

export type ProspectSearchAccountProgression = {
  qa_marker: typeof GROWTH_ACCOUNT_PROGRESSION_QA_MARKER
  progression_state: ProspectSearchAccountProgressionState
  progression_confidence: number
  momentum_trend: "strengthening" | "stable" | "weakening" | "blocked"
  progression_blockers: string[]
  missing_requirements: string[]
  recommended_advancement_path: string | null
  next_best_action: string
  progression_reasons: string[]
}

export function computeAccountProgression(input: {
  company: GrowthProspectSearchCompanyResult
  coverage?: ProspectSearchCompanyContactCoverageIntelligence | null
  accountStrategy?: ProspectSearchAccountContactStrategy | null
  relationshipMemory?: ProspectSearchRelationshipMemorySnapshot | null
  timeline?: ProspectSearchAccountTimeline | null
}): ProspectSearchAccountProgression {
  const progression_reasons: string[] = []
  const progression_blockers: string[] = []
  const missing_requirements: string[] = []

  const { company, coverage, accountStrategy, relationshipMemory, timeline } = input

  if (company.is_suppressed || relationshipMemory?.relationship_status === "blocked") {
    return {
      qa_marker: GROWTH_ACCOUNT_PROGRESSION_QA_MARKER,
      progression_state: "blocked",
      progression_confidence: 0.9,
      momentum_trend: "blocked",
      progression_blockers: [
        company.suppression_reason ?? "Compliance suppression active",
      ],
      missing_requirements: ["Resolve suppression before progression"],
      recommended_advancement_path: null,
      next_best_action: "Review suppression scope with operator before any outreach",
      progression_reasons: ["Account blocked by compliance"],
    }
  }

  const hasContacts =
    (coverage?.outreach_readiness_score ?? 0) > 0 ||
    (company.contact_intelligence?.contacts.length ?? 0) > 0
  const readiness = accountStrategy?.account_outreach_readiness
  const isOutreachReady = readiness === "ready" || readiness === "ready_with_review"

  let state: ProspectSearchAccountProgressionState = "discovered"
  let confidence = 0.45

  if (!hasContacts) {
    state = company.lead_engine_last_run_at ? "researching" : "discovered"
    missing_requirements.push("Verified decision-maker or operations contact")
    progression_reasons.push("Contact research incomplete")
    confidence = 0.55
  } else if (isOutreachReady) {
    state = "outreach_ready"
    progression_reasons.push("Account outreach readiness met")
    confidence = 0.72
  } else if (readiness === "research_needed" || readiness === "verification_needed") {
    state = "researching"
    missing_requirements.push(accountStrategy?.contact_research_next_step ?? "Complete contact verification")
    progression_reasons.push("Additional research or verification required")
    confidence = 0.65
  } else {
    state = "discovered"
  }

  const relStatus = relationshipMemory?.relationship_status
  if (relStatus === "warming") {
    state = "warming"
    progression_reasons.push("Relationship warming from observed engagement")
    confidence = Math.max(confidence, 0.68)
  } else if (relStatus === "engaged" || relStatus === "active") {
    state = relStatus === "active" ? "progressing" : "engaged"
    progression_reasons.push("Prior engagement on record")
    confidence = Math.max(confidence, 0.78)
  } else if (relStatus === "stalled") {
    state = "stalled"
    progression_blockers.push("No recent interaction — relationship stalled")
    confidence = Math.max(confidence, 0.7)
  } else if (relStatus === "disengaged") {
    state = "inactive"
    progression_blockers.push("Disengagement signals detected")
    confidence = Math.max(confidence, 0.68)
  }

  if (accountStrategy?.missing_personas.length) {
    missing_requirements.push(
      `Missing personas: ${accountStrategy.missing_personas.map((p) => p.replace(/_/g, " ")).join(", ")}`,
    )
  }
  if (accountStrategy?.blocked_contacts.length) {
    progression_blockers.push(
      `${accountStrategy.blocked_contacts.length} blocked contact(s) — review compliance`,
    )
  }

  const momentum_trend = relationshipMemory?.momentum_direction ?? "stable"

  let next_best_action =
    accountStrategy?.safest_next_action ??
    relationshipMemory?.recommended_next_action ??
    timeline?.recommended_next_action ??
    "Review account intelligence before next operator action"

  if (state === "outreach_ready" && accountStrategy?.primary_contact) {
    next_best_action = `Review outbound sequence starting with ${accountStrategy.primary_contact.full_name ?? accountStrategy.primary_contact.persona_label}`
  } else if (state === "stalled") {
    next_best_action = "Refresh stale contacts and reassess relationship before re-engaging"
  } else if (state === "researching") {
    next_best_action = "Run contact research — verified decision-maker coverage needed"
  }

  let recommended_advancement_path: string | null = null
  if (state === "discovered" || state === "researching") {
    recommended_advancement_path = "Discover contacts → verify channels → assess outreach readiness"
  } else if (state === "outreach_ready") {
    recommended_advancement_path = "Operator review → queue or call workflow → track response"
  } else if (state === "warming" || state === "engaged") {
    recommended_advancement_path = "Follow up on engagement → escalate persona if needed"
  }

  return {
    qa_marker: GROWTH_ACCOUNT_PROGRESSION_QA_MARKER,
    progression_state: state,
    progression_confidence: Number(Math.min(1, confidence).toFixed(2)),
    momentum_trend,
    progression_blockers: progression_blockers.slice(0, 4),
    missing_requirements: missing_requirements.slice(0, 4),
    recommended_advancement_path,
    next_best_action,
    progression_reasons: progression_reasons.slice(0, 5),
  }
}

export function resolveProgressionQueueBoost(
  progression: ProspectSearchAccountProgression | null | undefined,
): number {
  if (!progression || progression.progression_state === "blocked") return 0
  if (progression.progression_state === "engaged" || progression.progression_state === "progressing") {
    return 5
  }
  if (progression.progression_state === "warming" || progression.progression_state === "outreach_ready") {
    return 3
  }
  if (progression.progression_state === "stalled" || progression.progression_state === "inactive") {
    return -4
  }
  if (progression.momentum_trend === "strengthening") return 2
  if (progression.momentum_trend === "weakening") return -3
  return 0
}
