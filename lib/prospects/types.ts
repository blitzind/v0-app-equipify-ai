/**
 * Leads + Follow-Up Phase 1 — shared types.
 *
 * Centralized so the API and the UI agree on the pipeline status set, the
 * follow-up bucket vocabulary, and the row shape returned by the prospects
 * list endpoint.
 */

export const PROSPECT_STATUSES = [
  "new",
  "attempting_contact",
  "contacted",
  "qualified",
  "proposal_sent",
  "won",
  "lost",
  "nurture",
] as const

export type ProspectStatus = (typeof PROSPECT_STATUSES)[number]

/** Open pipeline stages (excludes terminal won/lost). */
export const ACTIVE_PROSPECT_STATUSES: ProspectStatus[] = [
  "new",
  "attempting_contact",
  "contacted",
  "qualified",
  "proposal_sent",
  "nurture",
]

/** Kanban / pipeline column order (left → right). */
export const PIPELINE_STAGE_ORDER: ProspectStatus[] = [
  "new",
  "attempting_contact",
  "contacted",
  "qualified",
  "proposal_sent",
  "won",
  "lost",
  "nurture",
]

/**
 * Bucket for the follow-up filter on the list page and dashboard widget.
 *
 * `this_week` covers the rest of the current week (after today, through
 * Sunday). `upcoming` is *next week onward* — kept distinct from
 * `this_week` so the dashboard widget can prioritize "what should I act on
 * right now" without dragging in everything in the next 90 days.
 */
export type FollowUpBucket =
  | "all"
  | "overdue"
  | "today"
  | "this_week"
  | "upcoming"
  | "none"

export type ProspectRow = {
  id: string
  organization_id: string
  company_name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  lead_source: string | null
  status: ProspectStatus
  next_follow_up_at: string | null
  last_contacted_at: string | null
  estimated_value_cents: number | null
  notes: string | null
  converted_customer_id: string | null
  converted_at: string | null
  archived_at: string | null
  assigned_to_user_id?: string | null
  last_contacted_by_user_id?: string | null
  next_action_owner_user_id?: string | null
  created_at: string
  updated_at: string
}

export type ProspectListItem = ProspectRow & {
  /**
   * Resolved company name of the converted customer (if `converted_customer_id`
   * points at a row the caller can read). Helps the UI link without exposing
   * the raw UUID.
   */
  converted_customer_name: string | null
  /** Resolved display labels for ownership UUIDs (best-effort). */
  assigned_to_label?: string | null
  last_contacted_by_label?: string | null
  next_action_owner_label?: string | null
}

export type FollowUpKpis = {
  overdue: number
  today: number
  upcoming: number
  noFollowUp: number
}

export type StatusKpis = Record<ProspectStatus, number>

/** POST /prospects/{id}/convert — `conversion_target` body field. */
export const PROSPECT_CONVERSION_TARGETS = [
  "customer",
  "customer_location",
  "quote",
  "work_order",
  "opportunity",
  "equipment",
] as const

export type ProspectConversionTarget = (typeof PROSPECT_CONVERSION_TARGETS)[number]
