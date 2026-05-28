/** Company-level contact coverage + persona gap intelligence. Client-safe. */

import {
  getCriticalRevenuePersonas,
  type ProspectSearchRevenuePersonaType,
} from "@/lib/growth/prospect-search/prospect-search-revenue-persona-intelligence"
import type { ProspectSearchContactPriorityTier } from "@/lib/growth/prospect-search/prospect-search-contact-ranking"

export type ProspectSearchCompanyContactCoverageIntelligence = {
  outreach_readiness_score: number
  persona_completeness: number
  missing_critical_roles: ProspectSearchRevenuePersonaType[]
  best_reachable_contact_id: string | null
  best_reachable_contact_name: string | null
  primary_recommended_contact_id: string | null
  secondary_contact_id: string | null
  email_coverage: boolean
  call_coverage: boolean
  verification_coverage: number
  coverage_label: string
  persona_gap_suggestions: string[]
  ranking_summary: string | null
}

type CoverageContact = {
  contact_id: string
  full_name?: string | null
  persona_type: ProspectSearchRevenuePersonaType
  outreach_rank_score: number
  priority_tier: ProspectSearchContactPriorityTier
  email_available: boolean
  phone_available: boolean
  call_ready: boolean
  email_eligibility: string
  is_recommended_contact?: boolean
  verification_status?: string
}

export function buildProspectSearchCompanyContactCoverageIntelligence(input: {
  company_name: string
  contacts: CoverageContact[]
  company_suppressed?: boolean
}): ProspectSearchCompanyContactCoverageIntelligence {
  const contacts = input.contacts.filter((c) => c.priority_tier !== "blocked")
  const all = input.contacts

  if (input.company_suppressed || all.length === 0) {
    return {
      outreach_readiness_score: 0,
      persona_completeness: 0,
      missing_critical_roles: getCriticalRevenuePersonas(),
      best_reachable_contact_id: null,
      best_reachable_contact_name: null,
      primary_recommended_contact_id: null,
      secondary_contact_id: null,
      email_coverage: false,
      call_coverage: false,
      verification_coverage: 0,
      coverage_label: input.company_suppressed ? "Blocked / suppressed" : "No contacts found",
      persona_gap_suggestions: input.company_suppressed
        ? []
        : ["Run Find contacts to extract website contacts"],
      ranking_summary: null,
    }
  }

  const personaTypes = new Set(contacts.map((c) => c.persona_type))
  const critical = getCriticalRevenuePersonas()
  const missing_critical_roles = critical.filter((role) => !personaTypes.has(role))

  const persona_completeness = Math.round(
    ((critical.length - missing_critical_roles.length) / critical.length) * 100,
  )

  const email_coverage = contacts.some((c) => c.email_available)
  const call_coverage = contacts.some((c) => c.phone_available && c.call_ready)
  const verifiedCount = contacts.filter((c) =>
    (c.verification_status ?? "").includes("verified"),
  ).length
  const verification_coverage =
    contacts.length > 0 ? Math.round((verifiedCount / contacts.length) * 100) : 0

  const ranked = [...contacts].sort((a, b) => b.outreach_rank_score - a.outreach_rank_score)
  const best = ranked[0] ?? null
  const primary = contacts.find((c) => c.is_recommended_contact) ?? best
  const secondary =
    contacts.find(
      (c) =>
        c.contact_id !== primary?.contact_id &&
        c.outreach_rank_score >= 0.5 &&
        c.priority_tier !== "low_confidence",
    ) ?? null

  let outreach_readiness_score = 0
  if (best) outreach_readiness_score += best.outreach_rank_score * 50
  outreach_readiness_score += persona_completeness * 0.2
  if (email_coverage) outreach_readiness_score += 15
  if (call_coverage) outreach_readiness_score += 15
  outreach_readiness_score += verification_coverage * 0.1
  outreach_readiness_score = Math.round(Math.min(100, outreach_readiness_score))

  let coverage_label = "Limited outreach coverage"
  if (outreach_readiness_score >= 80) coverage_label = "Strong outreach coverage"
  else if (outreach_readiness_score >= 60) coverage_label = "Moderate outreach coverage"
  else if (!email_coverage && !call_coverage) coverage_label = "Name-only contacts — channels missing"
  else if (email_coverage && !call_coverage) coverage_label = "Email coverage only"
  else if (call_coverage && !email_coverage) coverage_label = "Phone-ready contact discovered"

  const persona_gap_suggestions: string[] = []
  if (missing_critical_roles.includes("owner")) {
    persona_gap_suggestions.push("No owner/founder contact found — review website leadership pages")
  }
  if (missing_critical_roles.includes("operations_manager")) {
    persona_gap_suggestions.push("No operations contact found — search for operations role")
  }
  if (missing_critical_roles.includes("service_manager")) {
    persona_gap_suggestions.push("No service manager found — common buyer for field service ICP")
  }
  if (missing_critical_roles.includes("dispatcher") && call_coverage) {
    persona_gap_suggestions.push("Dispatcher persona missing — may still reach via phone-ready manager")
  }
  if (!email_coverage && !call_coverage) {
    persona_gap_suggestions.push("Run additional contact research — only generic or partial contacts")
  }
  if (verification_coverage < 50) {
    persona_gap_suggestions.push("Refresh verification — many contacts unverified")
  }

  const ranking_summary = primary
    ? `Best outreach target: ${primary.full_name ?? "Recommended contact"} (${Math.round(primary.outreach_rank_score * 100)}% rank)`
    : null

  return {
    outreach_readiness_score,
    persona_completeness,
    missing_critical_roles,
    best_reachable_contact_id: best?.contact_id ?? null,
    best_reachable_contact_name: best?.full_name ?? null,
    primary_recommended_contact_id: primary?.contact_id ?? null,
    secondary_contact_id: secondary?.contact_id ?? null,
    email_coverage,
    call_coverage,
    verification_coverage,
    coverage_label,
    persona_gap_suggestions: persona_gap_suggestions.slice(0, 4),
    ranking_summary,
  }
}
