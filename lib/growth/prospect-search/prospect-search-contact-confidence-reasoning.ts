/** Structured confidence reasoning for Prospect Search People rows. Client-safe. */

import {
  formatProspectSearchFreshnessLabel,
  type ProspectSearchContactFreshnessStatus,
} from "@/lib/growth/prospect-search/prospect-search-contact-freshness"
import {
  formatEmailVerificationDepthLabel,
  formatPhoneVerificationDepthLabel,
  type ProspectSearchEmailVerificationDepth,
  type ProspectSearchPhoneVerificationDepth,
} from "@/lib/growth/prospect-search/prospect-search-contact-verification-depth"
import { shadowCompareProspectSearchVerificationDepth } from "@/lib/growth/contact-verification/confidence-signals-shadow"

export type ProspectSearchContactConfidenceReasoning = {
  confidence_score: number
  confidence_label: "high" | "moderate" | "low" | "insufficient"
  summary: string
  top_reasons: string[]
  risk_notes: string[]
}

function clampScore(value: number): number {
  return Number(Math.min(1, Math.max(0, value)).toFixed(3))
}

function scoreLabel(score: number): ProspectSearchContactConfidenceReasoning["confidence_label"] {
  if (score >= 0.8) return "high"
  if (score >= 0.6) return "moderate"
  if (score >= 0.45) return "low"
  return "insufficient"
}

export function buildProspectSearchContactConfidenceReasoning(input: {
  confidence?: number | null
  email?: string | null
  phone?: string | null
  title?: string | null
  source_label?: string | null
  source_page_url?: string | null
  source_evidence_count?: number
  email_verification_depth?: ProspectSearchEmailVerificationDepth | null
  phone_verification_depth?: ProspectSearchPhoneVerificationDepth | null
  freshness_status?: ProspectSearchContactFreshnessStatus
  company_match_confidence?: number | null
  company_suppressed?: boolean
  phone_on_dnc?: boolean | null
}): ProspectSearchContactConfidenceReasoning {
  const top_reasons: string[] = []
  const risk_notes: string[] = []
  let score = input.confidence ?? 0.5

  const evidenceCount = input.source_evidence_count ?? 0
  if (evidenceCount >= 2) {
    score += 0.05
    top_reasons.push(`${evidenceCount} corroborating evidence source(s)`)
  } else if (evidenceCount === 1) {
    top_reasons.push("Single evidence-backed source")
  } else {
    score -= 0.08
    risk_notes.push("Limited corroborating evidence")
  }

  if (input.source_page_url?.trim() || (input.source_label ?? "").toLowerCase().includes("website")) {
    top_reasons.push("Contact published on company website")
  }

  if (input.email?.trim()) {
    const depth = input.email_verification_depth
    if (depth === "published_on_website") {
      score += 0.06
      top_reasons.push("Email published on website contact page")
    } else if (depth === "role_email") {
      top_reasons.push("Role-based email discovered")
    } else if (depth === "personal_email") {
      top_reasons.push("Personal-format email discovered")
    } else if (depth === "verification_needed") {
      score -= 0.1
      risk_notes.push("Email found but not verified")
    } else if (depth === "invalid_format" || depth === "disposable_domain") {
      score -= 0.2
      risk_notes.push(`Email issue: ${formatEmailVerificationDepthLabel(depth)}`)
    }
  }

  if (input.phone?.trim()) {
    const depth = input.phone_verification_depth
    if (depth === "published_on_website") {
      score += 0.05
      top_reasons.push("Phone found on public website")
    } else if (depth === "mobile_possible") {
      top_reasons.push("Mobile-capable phone pattern")
    } else if (depth === "office_line" || depth === "toll_free") {
      top_reasons.push(`Phone type: ${formatPhoneVerificationDepthLabel(depth)}`)
    } else if (depth === "dnc_blocked") {
      score -= 0.25
      risk_notes.push("Phone matched DNC registry")
    } else if (depth === "verification_needed") {
      risk_notes.push("Phone found, verification pending")
    }
  }

  if (input.title?.trim()) {
    const title = input.title.toLowerCase()
    if (
      title.includes("owner") ||
      title.includes("president") ||
      title.includes("director") ||
      title.includes("manager")
    ) {
      score += 0.04
      top_reasons.push("Title aligns with decision-maker outreach")
    }
  }

  if (input.company_match_confidence != null && input.company_match_confidence >= 0.7) {
    score += 0.03
    top_reasons.push(
      `Strong company match (${Math.round(input.company_match_confidence * 100)}%)`,
    )
  }

  const freshness = input.freshness_status ?? "unknown"
  if (freshness === "fresh") {
    top_reasons.push("Checked recently")
  } else if (freshness === "aging") {
    risk_notes.push(formatProspectSearchFreshnessLabel(freshness))
  } else if (freshness === "stale" || freshness === "expired") {
    score -= 0.12
    risk_notes.push(formatProspectSearchFreshnessLabel(freshness))
  } else if (freshness === "unknown") {
    risk_notes.push("Freshness unknown — consider refresh")
  }

  if (input.company_suppressed) {
    score -= 0.3
    risk_notes.push("Company suppressed for outreach")
  }
  if (input.phone_on_dnc === true) {
    risk_notes.push("DNC blocked for calling")
  }

  const confidence_score = clampScore(score)
  const confidence_label = scoreLabel(confidence_score)

  const parts: string[] = []
  parts.push(
    `${confidence_label.charAt(0).toUpperCase()}${confidence_label.slice(1)} confidence`,
  )
  if (top_reasons[0]) parts.push(top_reasons[0].toLowerCase())
  if (freshness === "fresh") parts.push("checked recently")

  const result = {
    confidence_score,
    confidence_label,
    summary: parts.join(", ") + ".",
    top_reasons: top_reasons.slice(0, 5),
    risk_notes: risk_notes.slice(0, 4),
  }

  shadowCompareProspectSearchVerificationDepth({
    email_verification_depth: input.email_verification_depth,
    legacy_confidence_score: result.confidence_score,
    email: input.email,
    email_present: Boolean(input.email?.trim()),
    integration: "buildProspectSearchContactConfidenceReasoning",
  })

  return result
}
