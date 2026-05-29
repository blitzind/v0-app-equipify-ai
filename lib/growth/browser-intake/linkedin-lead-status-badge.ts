/** LinkedIn lead status badge labels and resolution — client-safe. */

import type { GrowthCapturedLeadVerificationStatus } from "@/lib/growth/captured-leads/captured-lead-types"

export const GROWTH_LINKEDIN_LEAD_STATUS_BADGES = [
  "not_added",
  "already_added",
  "needs_review",
  "verified",
  "company_captured_only",
] as const

export type GrowthLinkedInLeadStatusBadge = (typeof GROWTH_LINKEDIN_LEAD_STATUS_BADGES)[number]

export const GROWTH_LINKEDIN_EXTENSION_STATUS_BADGE_LABELS: Record<GrowthLinkedInLeadStatusBadge, string> = {
  not_added: "Not added",
  already_added: "Already added",
  needs_review: "Needs review",
  verified: "Verified",
  company_captured_only: "Company captured only",
}

export const GROWTH_LINKEDIN_PAGE_STATUS_BADGE_LABELS: Record<GrowthLinkedInLeadStatusBadge, string> = {
  not_added: "Not in Equipify",
  already_added: "Added to Equipify",
  needs_review: "Needs review",
  verified: "Verified lead",
  company_captured_only: "Company captured only",
}

export function resolveLinkedInLeadStatusBadge(input: {
  matched: boolean
  confidence: number
  capture_type?: "company_only" | "contact" | null
  review_status?: "needs_review" | "reviewed" | null
  verification_status?: GrowthCapturedLeadVerificationStatus | null
}): GrowthLinkedInLeadStatusBadge {
  if (!input.matched || input.confidence < 0.7) return "not_added"
  if (input.capture_type === "company_only") return "company_captured_only"
  if (input.review_status === "needs_review") return "needs_review"
  if (input.verification_status === "verified") return "verified"
  return "already_added"
}

export function formatLinkedInLeadMatchSummary(input: {
  match_label?: string | null
  rule?: string | null
  confidence?: number | null
}): string {
  const label = (input.match_label ?? input.rule ?? "match").trim()
  const confidence = typeof input.confidence === "number" ? Math.round(input.confidence * 100) : null
  return confidence == null ? label : `${label} · ${confidence}% confidence`
}

export function linkedInLeadStatusBadgeTone(
  badge: GrowthLinkedInLeadStatusBadge,
): "neutral" | "good" | "warn" | "info" {
  if (badge === "verified" || badge === "already_added") return "good"
  if (badge === "needs_review") return "warn"
  if (badge === "company_captured_only") return "info"
  return "neutral"
}
