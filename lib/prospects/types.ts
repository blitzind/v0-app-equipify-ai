/**
 * Leads + Follow-Up Phase 1 — shared types.
 *
 * Centralized so the API and the UI agree on the pipeline status set, the
 * follow-up bucket vocabulary, and the row shape returned by the prospects
 * list endpoint.
 */

export const PROSPECT_STATUSES = [
  "new",
  "contacted",
  "follow_up",
  "quoted",
  "won",
  "lost",
] as const

export type ProspectStatus = (typeof PROSPECT_STATUSES)[number]

export const ACTIVE_PROSPECT_STATUSES: ProspectStatus[] = [
  "new",
  "contacted",
  "follow_up",
  "quoted",
]

/** Bucket for the follow-up filter on the list page. */
export type FollowUpBucket = "all" | "overdue" | "today" | "upcoming" | "none"

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
}

export type FollowUpKpis = {
  overdue: number
  today: number
  upcoming: number
  noFollowUp: number
}

export type StatusKpis = Record<ProspectStatus, number>
