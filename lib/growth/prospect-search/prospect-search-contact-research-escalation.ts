/** Contact research escalation — focused acquisition without deep overlays. Client-safe. */

import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import { resolveProspectSearchReachableHumanScore } from "@/lib/growth/prospect-search/prospect-search-reachable-human-scoring"

export const GROWTH_CONTACT_RESEARCH_ESCALATION_QA_MARKER =
  "growth-contact-research-escalation-v1" as const

export type ProspectSearchContactResearchEscalationAction =
  | "team_page_crawl"
  | "leadership_crawl"
  | "contact_page_expansion"
  | "branch_page_crawl"
  | "structured_data_extract"
  | "dispatch_service_email_extract"
  | "public_profile_reference_extract"

export type ProspectSearchContactResearchEscalationPlan = {
  qa_marker: typeof GROWTH_CONTACT_RESEARCH_ESCALATION_QA_MARKER
  should_escalate: boolean
  priority: "high" | "moderate" | "low"
  actions: ProspectSearchContactResearchEscalationAction[]
  skip_deep_overlays: boolean
  reasons: string[]
}

export function buildProspectSearchContactResearchEscalationPlan(
  company: GrowthProspectSearchCompanyResult,
): ProspectSearchContactResearchEscalationPlan {
  const reachable = resolveProspectSearchReachableHumanScore(company)
  const actions: ProspectSearchContactResearchEscalationAction[] = []
  const reasons: string[] = []

  if (reachable.label === "outreach_ready") {
    return {
      qa_marker: GROWTH_CONTACT_RESEARCH_ESCALATION_QA_MARKER,
      should_escalate: false,
      priority: "low",
      actions: [],
      skip_deep_overlays: false,
      reasons: ["Reachable humans already present"],
    }
  }

  if (!company.website?.trim()) {
    return {
      qa_marker: GROWTH_CONTACT_RESEARCH_ESCALATION_QA_MARKER,
      should_escalate: true,
      priority: "moderate",
      actions: ["structured_data_extract"],
      skip_deep_overlays: true,
      reasons: ["No website — limited to structured provider references"],
    }
  }

  actions.push("team_page_crawl", "contact_page_expansion", "leadership_crawl")
  reasons.push("No reachable humans — run focused website contact acquisition")

  if (reachable.label === "generic_channel_only") {
    actions.push("dispatch_service_email_extract", "public_profile_reference_extract")
    reasons.push("Generic channels only — expand to named people")
  }

  if (company.contact_intelligence?.contacts.some((c) => c.branch_name || c.branch_city)) {
    actions.push("branch_page_crawl")
    reasons.push("Branch evidence present — expand branch pages")
  }

  return {
    qa_marker: GROWTH_CONTACT_RESEARCH_ESCALATION_QA_MARKER,
    should_escalate: true,
    priority: reachable.label === "no_reachable_humans" ? "high" : "moderate",
    actions: [...new Set(actions)],
    skip_deep_overlays: true,
    reasons,
  }
}
