/** Smart contact ranking for Prospect Search outreach prioritization. Client-safe. */

import type { ProspectSearchContactEligibilityState } from "@/lib/growth/prospect-search/prospect-search-contact-eligibility"
import type { ProspectSearchContactFreshnessStatus } from "@/lib/growth/prospect-search/prospect-search-contact-freshness"
import type { ProspectSearchRevenuePersonaIntelligence } from "@/lib/growth/prospect-search/prospect-search-revenue-persona-intelligence"

export const GROWTH_CONTACT_RANKING_QA_MARKER = "growth-contact-ranking-v1" as const

export const PROSPECT_SEARCH_CONTACT_PRIORITY_TIERS = [
  "high_priority",
  "recommended",
  "review",
  "low_confidence",
  "blocked",
] as const

export type ProspectSearchContactPriorityTier =
  (typeof PROSPECT_SEARCH_CONTACT_PRIORITY_TIERS)[number]

export type ProspectSearchContactRankingInput = {
  contact_id: string
  company_id: string
  confidence_score: number
  persona: ProspectSearchRevenuePersonaIntelligence
  email_eligibility: ProspectSearchContactEligibilityState
  call_eligibility: ProspectSearchContactEligibilityState
  sms_eligibility?: ProspectSearchContactEligibilityState
  freshness_status: ProspectSearchContactFreshnessStatus
  outreach_ready: boolean
  call_ready: boolean
  email_available: boolean
  phone_available: boolean
  email_verification_depth?: string | null
  phone_verification_depth?: string | null
  source_label?: string | null
  company_match_confidence?: number | null
  company_suppressed?: boolean
  phone_on_dnc?: boolean | null
  in_lead_inbox?: boolean
  existing_customer?: boolean
  existing_prospect?: boolean
  lead_engine_score?: number | null
  relationship_strength_score?: number | null
  relationship_status?: string | null
  relationship_momentum?: string | null
  evidence_quality_score?: number | null
  evidence_quality_label?: string | null
  email_classification?: string | null
  phone_classification?: string | null
  linkedin_reference_label?: string | null
  branch_name?: string | null
  branch_city?: string | null
  branch_state?: string | null
}

export type ProspectSearchContactRankingResult = {
  outreach_rank_score: number
  priority_tier: ProspectSearchContactPriorityTier
  ranking_reasons: string[]
  ranking_risks: string[]
  recommended_next_action: string
  is_recommended_contact: boolean
  is_secondary_contact: boolean
}

function clamp(value: number): number {
  return Number(Math.min(1, Math.max(0, value)).toFixed(3))
}

function isBlocked(input: ProspectSearchContactRankingInput): boolean {
  return (
    input.company_suppressed === true ||
    input.phone_on_dnc === true ||
    input.email_eligibility === "suppressed" ||
    input.email_eligibility === "blocked" ||
    input.call_eligibility === "suppressed" ||
    input.call_eligibility === "blocked"
  )
}

function channelEligible(input: ProspectSearchContactRankingInput): boolean {
  return (
    input.email_eligibility === "eligible" ||
    input.call_eligibility === "eligible" ||
    input.outreach_ready
  )
}

export function rankProspectSearchContactsForOutreach(
  input: ProspectSearchContactRankingInput,
): ProspectSearchContactRankingResult {
  const ranking_reasons: string[] = []
  const ranking_risks: string[] = []
  let score = input.confidence_score * 0.35

  if (isBlocked(input)) {
    return {
      outreach_rank_score: 0,
      priority_tier: "blocked",
      ranking_reasons: ["Blocked by compliance or suppression"],
      ranking_risks: ranking_risks,
      recommended_next_action: "Do not outreach — resolve compliance block first",
      is_recommended_contact: false,
      is_secondary_contact: false,
    }
  }

  score += input.persona.icp_relevance * 0.2
  score += input.persona.buying_influence * 0.12
  score += input.persona.outreach_suitability * 0.1
  if (input.persona.confidence >= 0.7) {
    ranking_reasons.push(`Strong ${input.persona.persona_label} persona match`)
  } else if (input.persona.persona_type !== "unknown") {
    ranking_reasons.push(`${input.persona.persona_label} persona inferred from title`)
  } else {
    ranking_risks.push("Persona unclear from available title evidence")
    score -= 0.08
  }

  if (input.email_eligibility === "eligible") {
    score += 0.12
    ranking_reasons.push("Email outreach eligible")
  }
  if (input.call_eligibility === "eligible") {
    score += 0.1
    ranking_reasons.push("Call outreach eligible")
  } else if (input.call_ready && input.phone_available) {
    ranking_reasons.push("Phone available — call review may be needed")
  }

  if (input.freshness_status === "fresh") {
    score += 0.08
    ranking_reasons.push("Fresh contact data")
  } else if (input.freshness_status === "stale" || input.freshness_status === "expired") {
    score -= 0.12
    ranking_risks.push("Stale or expired verification")
  } else if (input.freshness_status === "aging") {
    ranking_risks.push("Contact data aging")
  }

  if (input.email_verification_depth === "published_on_website") {
    score += 0.06
    ranking_reasons.push("Email published on website")
  }
  if (input.phone_verification_depth === "published_on_website") {
    score += 0.05
    ranking_reasons.push("Phone published on website")
  }

  if ((input.source_label ?? "").toLowerCase().includes("website")) {
    score += 0.04
    ranking_reasons.push("Website-backed evidence")
  }

  if (input.evidence_quality_label === "strong_public_evidence") {
    score += 0.08
    ranking_reasons.push("Strong public website evidence")
  } else if (input.evidence_quality_label === "moderate_public_evidence") {
    score += 0.04
    ranking_reasons.push("Moderate public website evidence")
  } else if (input.evidence_quality_label === "weak_public_evidence") {
    score += 0.01
    ranking_risks.push("Weak public evidence — verify before outreach")
  } else if (input.evidence_quality_label === "needs_review") {
    score -= 0.05
    ranking_risks.push("Evidence needs operator review")
  } else if (input.evidence_quality_label === "invalid") {
    score -= 0.15
    ranking_risks.push("Invalid or unreliable extraction evidence")
  }

  const genericEmailClassifications = new Set([
    "generic_info_email",
    "support_email",
    "department_email",
    "billing_email",
  ])
  if (
    input.email_classification &&
    genericEmailClassifications.has(input.email_classification)
  ) {
    score -= 0.04
    ranking_reasons.push("Generic role email — lower priority but may support outreach")
  } else if (
    input.email_classification === "sales_email" ||
    input.email_classification === "dispatch_email" ||
    input.email_classification === "owner_leadership_email"
  ) {
    score += 0.02
    ranking_reasons.push("Operational or leadership email classification")
  }

  if (input.linkedin_reference_label) {
    score += 0.03
    ranking_reasons.push("LinkedIn reference found on company website")
  }

  if (input.branch_name || input.branch_city) {
    score += 0.03
    ranking_reasons.push("Branch or location mapping from website")
  }

  if (input.company_match_confidence != null && input.company_match_confidence >= 0.7) {
    score += 0.04
    ranking_reasons.push("Strong company ICP match")
  }

  if (input.lead_engine_score != null && input.lead_engine_score >= 70) {
    score += 0.05
    ranking_reasons.push("High Lead Engine company score")
  }

  if (input.in_lead_inbox) {
    score += 0.03
    ranking_reasons.push("Existing Lead Inbox relationship")
  }
  if (input.existing_customer) {
    ranking_risks.push("Existing customer — coordinate account expansion carefully")
  }
  if (input.existing_prospect) {
    ranking_reasons.push("Known CRM prospect")
  }

  if (input.relationship_status === "engaged" || input.relationship_status === "active") {
    score += 0.05
    ranking_reasons.push("Previously responsive relationship on record")
  } else if (input.relationship_status === "warming") {
    score += 0.03
    ranking_reasons.push("Warming relationship — prior operator engagement")
  } else if (input.relationship_status === "stalled" || input.relationship_status === "disengaged") {
    score -= 0.06
    ranking_risks.push("Stalled or disengaged relationship — review before outreach")
  }
  if (input.relationship_momentum === "strengthening") {
    score += 0.03
    ranking_reasons.push("Relationship momentum strengthening")
  } else if (input.relationship_momentum === "weakening") {
    score -= 0.04
    ranking_risks.push("Relationship momentum weakening")
  }
  if ((input.relationship_strength_score ?? 0) >= 60) {
    score += 0.02
  }

  if (input.email_eligibility === "needs_review" || input.call_eligibility === "needs_review") {
    ranking_risks.push("Operator review required before outreach")
  }
  if (input.email_eligibility === "verification_required" || input.call_eligibility === "verification_required") {
    score -= 0.1
    ranking_risks.push("Verification required")
  }

  if (!input.email_available && !input.phone_available) {
    score -= 0.2
    ranking_risks.push("No reachable channels on file")
  }

  const outreach_rank_score = clamp(score)

  let priority_tier: ProspectSearchContactPriorityTier = "review"
  if (outreach_rank_score >= 0.82 && channelEligible(input) && input.freshness_status === "fresh") {
    priority_tier = "high_priority"
  } else if (outreach_rank_score >= 0.65 && channelEligible(input)) {
    priority_tier = "recommended"
  } else if (outreach_rank_score < 0.45 || input.confidence_score < 0.45) {
    priority_tier = "low_confidence"
  } else if (
    input.email_eligibility === "needs_review" ||
    input.call_eligibility === "needs_review" ||
    input.freshness_status === "stale"
  ) {
    priority_tier = "review"
  }

  let recommended_next_action = "Review contact evidence before outreach"
  if (priority_tier === "high_priority" && input.call_ready) {
    recommended_next_action = "Strong call candidate — review and add to Call Queue"
  } else if (priority_tier === "high_priority" && input.email_eligibility === "eligible") {
    recommended_next_action = "Strong email candidate — review and add to Queue"
  } else if (priority_tier === "recommended") {
    recommended_next_action = "Recommended outreach target — verify freshness then route"
  } else if (priority_tier === "low_confidence") {
    recommended_next_action = "Low confidence — refresh contact research before outreach"
  } else if (input.freshness_status === "stale" || input.freshness_status === "expired") {
    recommended_next_action = "Refresh verification before outreach"
  }

  return {
    outreach_rank_score,
    priority_tier,
    ranking_reasons: ranking_reasons.slice(0, 5),
    ranking_risks: ranking_risks.slice(0, 4),
    recommended_next_action,
    is_recommended_contact: false,
    is_secondary_contact: false,
  }
}

export function applyProspectSearchContactRankingToPeopleRows<
  T extends ProspectSearchContactRankingInput & {
    id: string
    company_id: string
    contact_id: string
    persona: ProspectSearchRevenuePersonaIntelligence
  },
>(
  rows: T[],
  rankFn: (
    input: ProspectSearchContactRankingInput,
  ) => ProspectSearchContactRankingResult = rankProspectSearchContactsForOutreach,
): Array<T & ProspectSearchContactRankingResult> {
  const ranked = rows.map((row) => ({
    ...row,
    ...rankFn(row),
  }))

  const byCompany = new Map<string, Array<T & ProspectSearchContactRankingResult>>()
  for (const row of ranked) {
    const list = byCompany.get(row.company_id) ?? []
    list.push(row)
    byCompany.set(row.company_id, list)
  }

  for (const [, companyRows] of byCompany) {
    const sorted = [...companyRows].sort((a, b) => b.outreach_rank_score - a.outreach_rank_score)
    const primary = sorted.find((row) => row.priority_tier !== "blocked") ?? null
    const secondary = sorted.filter(
      (row) => row.contact_id !== primary?.contact_id && row.priority_tier !== "blocked",
    )[0] ?? null
    for (const row of companyRows) {
      row.is_recommended_contact = primary?.contact_id === row.contact_id
      row.is_secondary_contact = secondary?.contact_id === row.contact_id
    }
  }

  return ranked.sort((a, b) => b.outreach_rank_score - a.outreach_rank_score)
}
