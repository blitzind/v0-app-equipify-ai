/** Captured lead follow-up workflow — client-safe types. */

import type { GrowthLeadSourceKind } from "@/lib/growth/types"

export const GROWTH_CAPTURED_LEADS_QA_MARKER = "growth-captured-leads-v1" as const

export const GROWTH_CAPTURED_LEAD_SOURCE_KINDS = ["manual", "browser_extension"] as const

export type GrowthCapturedLeadSourceKind = (typeof GROWTH_CAPTURED_LEAD_SOURCE_KINDS)[number]

export const GROWTH_CAPTURED_LEAD_FILTERS = [
  "all",
  "needs_review",
  "has_verified_email",
  "needs_contact_discovery",
  "linkedin_captured",
  "website_captured",
  "company_only",
] as const

export type GrowthCapturedLeadFilter = (typeof GROWTH_CAPTURED_LEAD_FILTERS)[number]

export const GROWTH_CAPTURED_LEAD_ACTIONS = [
  "mark_reviewed",
  "verify_email",
  "queue_contact_discovery",
  "add_to_call_queue",
  "create_sequence_draft",
] as const

export type GrowthCapturedLeadAction = (typeof GROWTH_CAPTURED_LEAD_ACTIONS)[number]

export type GrowthCapturedLeadReviewStatus = "needs_review" | "reviewed"

export type GrowthCapturedLeadReviewMeta = {
  status: GrowthCapturedLeadReviewStatus
  reviewed_at: string | null
  reviewed_by: string | null
}

export type GrowthCapturedLeadEnrichmentStatus =
  | "none"
  | "queued"
  | "running"
  | "completed"
  | "failed"

export type GrowthCapturedLeadVerificationStatus =
  | "none"
  | "unknown"
  | "verified"
  | "invalid"
  | "blocked"

export type GrowthCapturedLeadRow = {
  lead_id: string
  company_name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  website: string | null
  source_kind: GrowthCapturedLeadSourceKind
  source_platform: string | null
  source_url: string | null
  captured_at: string
  capture_type: "company_only" | "contact"
  enrichment_status: GrowthCapturedLeadEnrichmentStatus
  verification_status: GrowthCapturedLeadVerificationStatus
  review_status: GrowthCapturedLeadReviewStatus
  next_best_action: string | null
  next_best_action_label: string | null
  lead_status: string
  created_at: string
}

export type GrowthCapturedLeadActionResult = {
  ok: boolean
  action: GrowthCapturedLeadAction
  lead_id: string
  message: string
  row?: GrowthCapturedLeadRow
  enrollment_id?: string | null
  queue_item_id?: string | null
  company_candidate_id?: string | null
  workspace_href?: string | null
}

export function isGrowthCapturedLeadSourceKind(
  value: string,
): value is GrowthCapturedLeadSourceKind {
  return (GROWTH_CAPTURED_LEAD_SOURCE_KINDS as readonly string[]).includes(value)
}

export function isGrowthCapturedLeadSource(sourceKind: GrowthLeadSourceKind): sourceKind is GrowthCapturedLeadSourceKind {
  return isGrowthCapturedLeadSourceKind(sourceKind)
}
