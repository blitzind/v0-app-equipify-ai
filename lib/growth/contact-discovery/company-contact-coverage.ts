/** Deterministic company contact coverage scoring. Client-safe. */

import type {
  GrowthCompanyContact,
  GrowthCompanyContactCoverage,
} from "@/lib/growth/contact-discovery/company-contact-types"
import { rankCompanyContactsByDecisionMaker } from "@/lib/growth/contact-discovery/decision-maker-score"

function coverageLabel(score: number): GrowthCompanyContactCoverage["coverage_label"] {
  if (score >= 100) return "100%"
  if (score >= 75) return "75%"
  if (score >= 50) return "50%"
  if (score >= 25) return "25%"
  return "0%"
}

export function computeCompanyContactCoverage(contacts: GrowthCompanyContact[]): GrowthCompanyContactCoverage {
  const active = contacts.filter((contact) => contact.contact_status !== "suppressed" && contact.contact_status !== "archived")
  const ranked = rankCompanyContactsByDecisionMaker(active)
  const primary = ranked[0] ?? null
  const recommended = ranked.find((contact) => contact.decision_maker_score >= 75) ?? primary

  const decision_maker_discovered = active.some((contact) => contact.decision_maker_score >= 75)
  const verified_email = active.some((contact) => contact.email_status === "verified" || contact.email_status === "discovered")
  const verified_phone = active.some(
    (contact) => contact.phone_status === "business" || contact.phone_status === "mobile",
  )
  const multiple_contacts = active.length >= 2

  let coverage_score = 0
  if (decision_maker_discovered) coverage_score += 25
  if (verified_email) coverage_score += 25
  if (verified_phone) coverage_score += 25
  if (multiple_contacts) coverage_score += 25

  const contact_confidence_score =
    active.length === 0
      ? 0
      : Math.round(active.reduce((sum, contact) => sum + contact.confidence_score, 0) / active.length)

  return {
    coverage_score,
    coverage_label: coverageLabel(coverage_score),
    contact_confidence_score,
    primary_contact_id: primary?.id ?? null,
    recommended_contact_id: recommended?.id ?? null,
    decision_maker_discovered,
    verified_email,
    verified_phone,
    multiple_contacts,
  }
}
