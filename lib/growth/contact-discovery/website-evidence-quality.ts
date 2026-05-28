/** Evidence quality scoring for website-extracted contacts. Client-safe. */

import type {
  WebsiteEvidenceQualityLabel,
  WebsitePageType,
} from "@/lib/growth/contact-discovery/website-extraction-acquisition-types"
import type { ExtractedWebsiteContact } from "@/lib/growth/contact-discovery/extract/extract-shared"

const STRONG_PAGE_TYPES = new Set<WebsitePageType>([
  "team",
  "leadership",
  "staff",
  "about",
  "schema_org",
])

export function scoreWebsiteContactEvidenceQuality(input: {
  contact: ExtractedWebsiteContact
  pageType: WebsitePageType
  companyDomain?: string | null
  repeatedEvidenceCount?: number
}): {
  evidence_quality_score: number
  evidence_quality_label: WebsiteEvidenceQualityLabel
  evidence_quality_reasons: string[]
  extraction_risks: string[]
} {
  const reasons: string[] = []
  const risks: string[] = []
  let score = 0.35

  const { contact, pageType } = input
  const hasName = contact.full_name !== "Company contact" && contact.full_name.trim().length > 3
  const hasEmail = Boolean(contact.email?.trim())
  const hasPhone = Boolean(contact.phone?.trim())
  const hasTitle = Boolean(contact.title?.trim())
  const hasLinkedIn = Boolean(contact.linkedin_url?.trim())

  if (STRONG_PAGE_TYPES.has(pageType)) {
    score += 0.18
    reasons.push(`Source page type: ${pageType.replace(/_/g, " ")}`)
  } else if (pageType === "contact" || pageType === "footer") {
    score += 0.1
    reasons.push(`Contact channel page: ${pageType}`)
  }

  if (hasName && hasTitle) {
    score += 0.12
    reasons.push("Name and title observed together")
  } else if (!hasName && contact.full_name === "Company contact") {
    risks.push("Generic role contact — no named decision maker")
    score -= 0.05
  }

  if (hasEmail && hasName && contact.full_name !== "Company contact") {
    score += 0.1
    reasons.push("Email proximate to named person")
  }
  if (hasPhone && (pageType === "contact" || pageType === "locations" || pageType === "branch")) {
    score += 0.08
    reasons.push("Phone on contact/location page")
  }
  if (pageType === "schema_org") {
    score += 0.14
    reasons.push("Schema.org structured data")
  }
  if (hasLinkedIn) {
    score += 0.06
    reasons.push("LinkedIn profile reference on company website")
  }
  if (contact.leadership_indicator) {
    score += 0.08
    reasons.push("Leadership title indicator")
  }
  if ((input.repeatedEvidenceCount ?? 0) > 1) {
    score += 0.06
    reasons.push("Repeated across multiple crawled pages")
  }

  if (input.companyDomain && contact.email) {
    const domain = contact.email.split("@")[1]?.toLowerCase()
    const normalizedCompany = input.companyDomain.replace(/^www\./, "").toLowerCase()
    if (domain && (domain === normalizedCompany || domain.endsWith(`.${normalizedCompany}`))) {
      score += 0.08
      reasons.push("Email domain matches company website")
    } else if (domain) {
      risks.push("Email domain differs from company website")
      score -= 0.04
    }
  }

  if (!hasEmail && !hasPhone) {
    score = Math.min(score, 0.35)
    risks.push("Identity only — no direct channel observed")
  }

  score = Math.round(Math.min(1, Math.max(0, score)) * 100) / 100

  let evidence_quality_label: WebsiteEvidenceQualityLabel = "needs_review"
  if (score >= 0.75) evidence_quality_label = "strong_public_evidence"
  else if (score >= 0.58) evidence_quality_label = "moderate_public_evidence"
  else if (score >= 0.4) evidence_quality_label = "weak_public_evidence"
  else if (score < 0.2) evidence_quality_label = "invalid"

  return {
    evidence_quality_score: Math.round(score * 100),
    evidence_quality_label,
    evidence_quality_reasons: reasons.slice(0, 6),
    extraction_risks: risks.slice(0, 4),
  }
}
