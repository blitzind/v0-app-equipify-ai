/** Project growth.leads rows into captured-lead follow-up rows. Client-safe. */

import {
  GROWTH_NEXT_BEST_ACTION_LABELS,
  type GrowthNextBestAction,
} from "@/lib/growth/nba-types"
import type { GrowthLead } from "@/lib/growth/types"
import type {
  GrowthCapturedLeadEnrichmentStatus,
  GrowthCapturedLeadReviewMeta,
  GrowthCapturedLeadReviewStatus,
  GrowthCapturedLeadRow,
  GrowthCapturedLeadSourceKind,
  GrowthCapturedLeadVerificationStatus,
} from "@/lib/growth/captured-leads/captured-lead-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function readReviewMeta(metadata: Record<string, unknown>): GrowthCapturedLeadReviewMeta {
  const review = asRecord(metadata.captured_lead_review)
  const status = asString(review.status)
  return {
    status: status === "reviewed" ? "reviewed" : "needs_review",
    reviewed_at: asString(review.reviewed_at) || null,
    reviewed_by: asString(review.reviewed_by) || null,
  }
}

function readCapturedAt(lead: GrowthLead, metadata: Record<string, unknown>): string {
  const browser = asRecord(metadata.browser_extension)
  const browserCaptured = asString(browser.captured_at)
  if (browserCaptured) return browserCaptured

  const captures = metadata.browser_extension_captures
  if (Array.isArray(captures) && captures.length > 0) {
    const last = captures[captures.length - 1]
    const capturedAt = asString(asRecord(last).captured_at)
    if (capturedAt) return capturedAt
  }

  const manual = asRecord(metadata.manual_entry)
  const manualCaptured = asString(manual.entered_at)
  if (manualCaptured) return manualCaptured

  return lead.createdAt
}

function readSourcePlatform(lead: GrowthLead, metadata: Record<string, unknown>): string | null {
  if (lead.sourceKind === "browser_extension") {
    const browser = asRecord(metadata.browser_extension)
    return asString(browser.source_platform) || "other"
  }
  return "manual"
}

function readSourceUrl(metadata: Record<string, unknown>): string | null {
  const browser = asRecord(metadata.browser_extension)
  return asString(browser.source_url) || null
}

function readCaptureType(metadata: Record<string, unknown>, lead: GrowthLead): "company_only" | "contact" {
  const browser = asRecord(metadata.browser_extension)
  if (asString(browser.capture_type) === "company_only") return "company_only"
  if (asRecord(metadata.company_prospect).status) return "company_only"
  if (!lead.contactName && !lead.contactEmail && !lead.contactPhone) return "company_only"
  return "contact"
}

function readEnrichmentStatus(metadata: Record<string, unknown>): GrowthCapturedLeadEnrichmentStatus {
  const queue = asRecord(metadata.contact_discovery_queue)
  const status = asString(queue.status)
  if (status === "queued") return "queued"
  if (status === "running") return "running"
  if (status === "completed") return "completed"
  if (status === "failed") return "failed"
  return "none"
}

function readVerificationStatus(metadata: Record<string, unknown>): GrowthCapturedLeadVerificationStatus {
  const verification = asRecord(metadata.email_verification)
  if (!Object.keys(verification).length) return "none"

  if (verification.blocked_by_suppression === true) return "blocked"

  const providerStatus = asString(verification.provider_status).toLowerCase()
  if (providerStatus === "invalid" || providerStatus === "invalid_format") return "invalid"
  if (verification.verified_by_provider === true) return "verified"
  if (providerStatus === "valid" || providerStatus === "discovered") return "verified"

  return "unknown"
}

export function projectGrowthCapturedLeadRow(lead: GrowthLead): GrowthCapturedLeadRow | null {
  if (lead.sourceKind !== "manual" && lead.sourceKind !== "browser_extension") return null

  const metadata = lead.metadata ?? {}
  const review = readReviewMeta(metadata)
  const nextAction = lead.nextBestAction as GrowthNextBestAction | null

  return {
    lead_id: lead.id,
    company_name: lead.companyName,
    contact_name: lead.contactName,
    contact_email: lead.contactEmail,
    contact_phone: lead.contactPhone,
    website: lead.website,
    source_kind: lead.sourceKind as GrowthCapturedLeadSourceKind,
    source_platform: readSourcePlatform(lead, metadata),
    source_url: readSourceUrl(metadata),
    captured_at: readCapturedAt(lead, metadata),
    capture_type: readCaptureType(metadata, lead),
    enrichment_status: readEnrichmentStatus(metadata),
    verification_status: readVerificationStatus(metadata),
    review_status: review.status,
    next_best_action: lead.nextBestAction,
    next_best_action_label: nextAction ? GROWTH_NEXT_BEST_ACTION_LABELS[nextAction] : null,
    lead_status: lead.status,
    created_at: lead.createdAt,
  }
}

export function buildCapturedLeadReviewPatch(input: {
  status: GrowthCapturedLeadReviewStatus
  reviewedBy: string | null
}): Record<string, unknown> {
  return {
    captured_lead_review: {
      status: input.status,
      reviewed_at: input.status === "reviewed" ? new Date().toISOString() : null,
      reviewed_by: input.reviewedBy,
    },
  }
}

export function matchesCapturedLeadFilter(
  row: GrowthCapturedLeadRow,
  filter: string,
): boolean {
  if (filter === "all") return true
  if (filter === "needs_review") return row.review_status === "needs_review"
  if (filter === "has_verified_email") return row.verification_status === "verified"
  if (filter === "needs_contact_discovery") {
    return (
      row.capture_type === "company_only" ||
      row.enrichment_status === "none" ||
      row.enrichment_status === "failed"
    )
  }
  if (filter === "linkedin_captured") return row.source_platform === "linkedin"
  if (filter === "website_captured") return row.source_platform === "website"
  if (filter === "company_only") return row.capture_type === "company_only"
  return true
}

export function countCapturedLeadFilters(rows: GrowthCapturedLeadRow[]): Record<string, number> {
  const counts: Record<string, number> = { all: rows.length }
  for (const filter of [
    "needs_review",
    "has_verified_email",
    "needs_contact_discovery",
    "linkedin_captured",
    "website_captured",
    "company_only",
  ]) {
    counts[filter] = rows.filter((row) => matchesCapturedLeadFilter(row, filter)).length
  }
  return counts
}
