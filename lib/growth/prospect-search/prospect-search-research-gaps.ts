/** Smart research gap detection — operator-triggered, evidence-backed. Client-safe. */

import type { ProspectSearchAccountContactStrategy } from "@/lib/growth/prospect-search/prospect-search-account-contact-strategy"
import type { ProspectSearchCompanyContactCoverageIntelligence } from "@/lib/growth/prospect-search/prospect-search-company-contact-coverage-intelligence"
import type { ProspectSearchOrgIntelligence } from "@/lib/growth/prospect-search/prospect-search-org-intelligence"
import type { ProspectSearchRevenuePersonaType } from "@/lib/growth/prospect-search/prospect-search-revenue-persona-intelligence"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthProspectSearchPeopleResultRow } from "@/lib/growth/prospect-search/prospect-search-contact-discovery"

export const GROWTH_SMART_RESEARCH_QA_MARKER = "growth-smart-research-v1" as const

export const PROSPECT_SEARCH_RESEARCH_ACTION_KINDS = [
  "find_operations_manager",
  "find_owner",
  "refresh_stale_contacts",
  "rerun_website_extraction",
  "research_branch_leadership",
  "verify_phone_numbers",
  "improve_call_readiness",
  "expand_relationship_coverage",
  "verify_email",
  "improve_persona_coverage",
] as const

export type ProspectSearchResearchActionKind =
  (typeof PROSPECT_SEARCH_RESEARCH_ACTION_KINDS)[number]

export type ProspectSearchResearchTask = {
  id: string
  action_kind: ProspectSearchResearchActionKind
  label: string
  description: string
  urgency: "low" | "moderate" | "high"
  evidence: string[]
  expected_operational_value: string
  research_value_score: number
  persona_target?: ProspectSearchRevenuePersonaType | null
  operator_triggered: true
}

export type ProspectSearchResearchGapsSnapshot = {
  qa_marker: typeof GROWTH_SMART_RESEARCH_QA_MARKER
  tasks: ProspectSearchResearchTask[]
  research_value_score: number
  expected_readiness_improvement: number
  expected_outreach_unlock_potential: number
  confidence_improvement_potential: number
  summary: string | null
}

function pushTask(
  tasks: ProspectSearchResearchTask[],
  task: Omit<ProspectSearchResearchTask, "id" | "operator_triggered" | "research_value_score"> & {
    research_value_score?: number
  },
): void {
  tasks.push({
    ...task,
    id: `${task.action_kind}:${task.label.slice(0, 24)}`,
    operator_triggered: true,
    research_value_score:
      task.research_value_score ??
      Math.round(
        (task.urgency === "high" ? 30 : task.urgency === "moderate" ? 20 : 10) +
          task.evidence.length * 5,
      ),
  })
}

export function buildProspectResearchGaps(input: {
  company: GrowthProspectSearchCompanyResult
  peopleRows: GrowthProspectSearchPeopleResultRow[]
  coverage: ProspectSearchCompanyContactCoverageIntelligence
  accountStrategy: ProspectSearchAccountContactStrategy
  orgIntelligence?: ProspectSearchOrgIntelligence | null
  territory_score?: number | null
  opportunity_score?: number | null
}): ProspectSearchResearchGapsSnapshot {
  const tasks: ProspectSearchResearchTask[] = []
  const {
    company,
    peopleRows,
    coverage,
    accountStrategy,
    orgIntelligence,
    territory_score,
    opportunity_score,
  } = input

  const stale = peopleRows.filter(
    (row) => row.freshness_status === "stale" || row.freshness_status === "expired",
  )
  const lowConfidence = peopleRows.filter((row) => row.confidence < 0.45)
  const noCallReady = peopleRows.every((row) => !row.call_ready)
  const noVerifiedEmail = peopleRows.every(
    (row) => !row.email_available || row.email_eligibility !== "eligible",
  )

  for (const persona of accountStrategy.missing_personas) {
    const kind: ProspectSearchResearchActionKind =
      persona === "operations_manager"
        ? "find_operations_manager"
        : persona === "owner"
          ? "find_owner"
          : "improve_persona_coverage"
    pushTask(tasks, {
      action_kind: kind,
      label: `Find ${persona.replace(/_/g, " ")}`,
      description: `Missing ${persona.replace(/_/g, " ")} persona on account strategy`,
      urgency: persona === "operations_manager" ? "high" : "moderate",
      evidence: [`Missing persona: ${persona}`],
      expected_operational_value: "Unlock operational buyer outreach path",
      persona_target: persona,
      research_value_score: persona === "operations_manager" ? 45 : 30,
    })
  }

  if (stale.length > 0) {
    pushTask(tasks, {
      action_kind: "refresh_stale_contacts",
      label: "Refresh stale contacts",
      description: `${stale.length} contact(s) need verification refresh`,
      urgency: stale.length >= peopleRows.length / 2 ? "high" : "moderate",
      evidence: stale
        .map((row) => `${row.full_name ?? row.persona_label}: ${row.freshness_status}`)
        .slice(0, 3),
      expected_operational_value: "Restore outreach and call eligibility",
      research_value_score: 40 + stale.length * 4,
    })
  }

  if (noCallReady && peopleRows.length > 0) {
    pushTask(tasks, {
      action_kind: "improve_call_readiness",
      label: "Improve call readiness",
      description: "No call-ready eligible contacts on account",
      urgency: "moderate",
      evidence: ["Zero call-ready contacts"],
      expected_operational_value: "Enable call-first outreach path",
      research_value_score: 35,
    })
  }

  if (noVerifiedEmail && peopleRows.length > 0) {
    pushTask(tasks, {
      action_kind: "verify_email",
      label: "Verify email coverage",
      description: "No verified email-eligible contacts",
      urgency: "moderate",
      evidence: ["No email-eligible contacts"],
      expected_operational_value: "Enable email-first sequence path",
      research_value_score: 28,
    })
  }

  if (lowConfidence.length > 0) {
    pushTask(tasks, {
      action_kind: "rerun_website_extraction",
      label: "Re-run website extraction",
      description: `${lowConfidence.length} low-confidence contact(s) — refresh sources`,
      urgency: "low",
      evidence: lowConfidence
        .map((row) => `${row.full_name ?? "Contact"}: ${Math.round(row.confidence * 100)}%`)
        .slice(0, 2),
      expected_operational_value: "Improve confidence scores from fresh evidence",
      research_value_score: 22,
    })
  }

  if (orgIntelligence?.structure_label === "branch_managed") {
    pushTask(tasks, {
      action_kind: "research_branch_leadership",
      label: "Research branch leadership",
      description: "Branch-managed structure — local leadership may differ from HQ",
      urgency: "moderate",
      evidence: [orgIntelligence.structure_summary],
      expected_operational_value: "Identify local decision path",
      research_value_score: 32,
    })
  }

  if (!orgIntelligence?.leadership_coverage && peopleRows.length > 0) {
    pushTask(tasks, {
      action_kind: "expand_relationship_coverage",
      label: "Expand relationship coverage",
      description: "Weak leadership coverage in org intelligence graph",
      urgency: "moderate",
      evidence: ["Org intelligence: leadership coverage incomplete"],
      expected_operational_value: "Strengthen account relationship map",
      research_value_score: 26,
    })
  }

  if (peopleRows.some((row) => row.phone && row.call_eligibility !== "eligible")) {
    pushTask(tasks, {
      action_kind: "verify_phone_numbers",
      label: "Verify phone numbers",
      description: "Contacts have phone but call eligibility blocked",
      urgency: "moderate",
      evidence: peopleRows
        .filter((row) => row.phone && row.call_eligibility !== "eligible")
        .map((row) => row.call_block_reason ?? "Call blocked")
        .slice(0, 2),
      expected_operational_value: "Unlock call channel where compliant",
      research_value_score: 30,
    })
  }

  const sorted = tasks.sort((a, b) => b.research_value_score - a.research_value_score)
  const research_value_score = Math.min(
    100,
    sorted.reduce((sum, task) => sum + task.research_value_score, 0),
  )
  const icpBoost = (company.lead_engine_score ?? company.lead_score ?? 0) >= 60 ? 12 : 0
  const territoryBoost = (territory_score ?? 0) >= 60 ? 10 : 0

  return {
    qa_marker: GROWTH_SMART_RESEARCH_QA_MARKER,
    tasks: sorted.slice(0, 8),
    research_value_score,
    expected_readiness_improvement: Math.min(
      100,
      Math.round(research_value_score * 0.6 + icpBoost + territoryBoost),
    ),
    expected_outreach_unlock_potential: Math.min(
      100,
      Math.round(
        (coverage.outreach_readiness_score < 50 ? 40 : 15) +
          (noCallReady ? 20 : 0) +
          (accountStrategy.missing_personas.length > 0 ? 15 : 0),
      ),
    ),
    confidence_improvement_potential: Math.min(
      100,
      Math.round(lowConfidence.length * 8 + stale.length * 6 + 10),
    ),
    summary:
      sorted.length === 0
        ? "No research gaps detected"
        : `${sorted.length} research task(s) — start with ${sorted[0]?.label ?? "coverage review"}`,
  }
}

export const PROSPECT_SEARCH_RESEARCH_QUEUE_KINDS = [
  "research_needed",
  "coverage_gap",
  "stale_accounts",
  "weak_territory",
] as const

export type ProspectSearchResearchQueueKind =
  (typeof PROSPECT_SEARCH_RESEARCH_QUEUE_KINDS)[number]

export function matchesProspectSearchResearchQueue(
  snapshot: ProspectSearchResearchGapsSnapshot,
  queueKind: ProspectSearchResearchQueueKind,
  input?: {
    territory_score?: number | null
    stale_contact_count?: number
  },
): boolean {
  switch (queueKind) {
    case "research_needed":
      return snapshot.tasks.length >= 1
    case "coverage_gap":
      return snapshot.tasks.some(
        (task) =>
          task.action_kind === "find_operations_manager" ||
          task.action_kind === "find_owner" ||
          task.action_kind === "improve_persona_coverage" ||
          task.action_kind === "expand_relationship_coverage",
      )
    case "stale_accounts":
      return (
        (input?.stale_contact_count ?? 0) > 0 ||
        snapshot.tasks.some((task) => task.action_kind === "refresh_stale_contacts")
      )
    case "weak_territory":
      return (input?.territory_score ?? 100) < 45 && snapshot.research_value_score >= 30
    default:
      return false
  }
}
