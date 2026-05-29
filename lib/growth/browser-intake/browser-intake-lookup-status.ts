/** Derive captured-lead status fields from lead metadata — client-safe. */

import type { GrowthCapturedLeadVerificationStatus } from "@/lib/growth/captured-leads/captured-lead-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

export function readBrowserIntakeReviewStatus(
  metadata: Record<string, unknown>,
): "needs_review" | "reviewed" {
  const review = asRecord(metadata.captured_lead_review)
  return asString(review.status) === "reviewed" ? "reviewed" : "needs_review"
}

export function readBrowserIntakeVerificationStatus(
  metadata: Record<string, unknown>,
): GrowthCapturedLeadVerificationStatus {
  const verification = asRecord(metadata.email_verification)
  if (!Object.keys(verification).length) return "none"

  if (verification.blocked_by_suppression === true) return "blocked"

  const providerStatus = asString(verification.provider_status).toLowerCase()
  if (providerStatus === "invalid" || providerStatus === "invalid_format") return "invalid"
  if (verification.verified_by_provider === true) return "verified"
  if (providerStatus === "valid" || providerStatus === "discovered") return "verified"

  return "unknown"
}

export function readBrowserIntakeCaptureType(
  metadata: Record<string, unknown>,
  lead: {
    contactName?: string | null
    contactEmail?: string | null
    contactPhone?: string | null
  },
): "company_only" | "contact" {
  const browser = asRecord(metadata.browser_extension)
  if (asString(browser.capture_type) === "company_only") return "company_only"
  if (asRecord(metadata.company_prospect).status) return "company_only"
  if (!lead.contactName && !lead.contactEmail && !lead.contactPhone) return "company_only"
  return "contact"
}
