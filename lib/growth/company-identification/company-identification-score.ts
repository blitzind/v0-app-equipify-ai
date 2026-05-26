import type {
  GrowthCompanyIdentificationMatchCandidate,
  GrowthCompanyIdentificationScoreContribution,
} from "@/lib/growth/company-identification/company-identification-types"

export function computeCompanyIdentificationScoreContribution(
  matches: GrowthCompanyIdentificationMatchCandidate[],
  top: GrowthCompanyIdentificationMatchCandidate | null,
): GrowthCompanyIdentificationScoreContribution {
  if (!top) {
    return { points: 0, reasons: [], breakdown: {}, confidence_boost: 0 }
  }

  const reasons: string[] = []
  const breakdown: Record<string, number> = {}
  let points = 0

  if (top.matched_source === "crm_customer" || top.matched_source === "crm_prospect") {
    points = 8
    breakdown.company_crm_match = points
    reasons.push(`Company CRM match (${top.matched_source}) (+${points}).`)
  } else if (top.matched_source === "growth_lead") {
    points = 7
    breakdown.company_growth_lead = points
    reasons.push(`Matched existing growth lead (+${points}).`)
  } else if (top.matched_source === "submitted_identity") {
    points = 6
    breakdown.company_submitted = points
    reasons.push(`Submitted company identity (+${points}).`)
  } else if (top.matched_source === "email_domain") {
    points = 5
    breakdown.company_email_domain = points
    reasons.push(`Business email domain (+${points}).`)
  } else if (top.matched_source === "landing_page_domain" || top.matched_source === "intent_history") {
    points = 3
    breakdown.company_domain_observed = points
    reasons.push(`Observed company domain (+${points}) — candidate only.`)
  } else {
    points = 2
    breakdown.company_inferred = points
    reasons.push(`Weak company inference (+${points}) — verify before outreach.`)
  }

  if (matches.length > 1) {
    breakdown.company_match_corroboration = 1
    points += 1
    reasons.push("Multiple corroborating company signals (+1).")
  }

  points = Math.min(10, points)

  return {
    points,
    reasons,
    breakdown,
    confidence_boost: Number(Math.min(0.15, top.match_confidence * 0.12).toFixed(3)),
  }
}
