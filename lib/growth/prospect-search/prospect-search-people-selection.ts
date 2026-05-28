/** People-first selection model for Prospect Search. Client-safe. */

import type { GrowthProspectSearchPeopleResultRow } from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import type { ProspectSearchContactEligibilityState } from "@/lib/growth/prospect-search/prospect-search-contact-eligibility"

export const GROWTH_PEOPLE_WORKFLOWS_QA_MARKER = "growth-people-workflows-v1" as const

export type ProspectSearchPeopleSelectionPayload = {
  selection_key: string
  contact_id: string
  company_id: string
  company_name: string
  full_name: string
  source_type: string
  source_label: string | null
  confidence: number
  verification_status: string
  outreach_ready: boolean
  call_ready: boolean
  sms_ready: boolean
  email_eligibility: ProspectSearchContactEligibilityState
  call_eligibility: ProspectSearchContactEligibilityState
  sms_eligibility: ProspectSearchContactEligibilityState
}

export function prospectSearchPeopleSelectionKey(
  row: Pick<GrowthProspectSearchPeopleResultRow, "id">,
): string {
  return row.id
}

export function buildProspectSearchPeopleSelectionPayload(
  row: GrowthProspectSearchPeopleResultRow,
): ProspectSearchPeopleSelectionPayload {
  return {
    selection_key: prospectSearchPeopleSelectionKey(row),
    contact_id: row.contact_id,
    company_id: row.company_id,
    company_name: row.company_name,
    full_name: row.full_name ?? "Unknown contact",
    source_type: row.source_type,
    source_label: row.source_label,
    confidence: row.confidence,
    verification_status: row.verification_status,
    outreach_ready: row.outreach_ready,
    call_ready: row.call_ready,
    sms_ready: row.sms_ready,
    email_eligibility: row.email_eligibility,
    call_eligibility: row.call_eligibility,
    sms_eligibility: row.sms_eligibility,
  }
}

export function mergeProspectSearchPeopleSelectionStore(input: {
  store: Map<string, GrowthProspectSearchPeopleResultRow>
  keys: Set<string>
  visibleRows: GrowthProspectSearchPeopleResultRow[]
}): Map<string, GrowthProspectSearchPeopleResultRow> {
  const next = new Map(input.store)
  for (const row of input.visibleRows) {
    const key = prospectSearchPeopleSelectionKey(row)
    if (input.keys.has(key)) next.set(key, row)
    else next.delete(key)
  }
  if (prospectSearchPeopleSelectionStoresEqual(input.store, next)) {
    return input.store
  }
  return next
}

function prospectSearchPeopleSelectionStoresEqual(
  left: Map<string, GrowthProspectSearchPeopleResultRow>,
  right: Map<string, GrowthProspectSearchPeopleResultRow>,
): boolean {
  if (left.size !== right.size) return false
  for (const [key, row] of left) {
    if (right.get(key) !== row) return false
  }
  return true
}

export function buildProspectSearchPeopleRowsVisibilityKey(
  rows: GrowthProspectSearchPeopleResultRow[],
): string {
  if (rows.length === 0) return ""
  return rows.map((row) => row.id).join("\u0001")
}

export function selectedProspectSearchPeopleRows(input: {
  keys: Set<string>
  store: Map<string, GrowthProspectSearchPeopleResultRow>
  fallbackRows: GrowthProspectSearchPeopleResultRow[]
}): GrowthProspectSearchPeopleResultRow[] {
  const rows: GrowthProspectSearchPeopleResultRow[] = []
  for (const key of input.keys) {
    const stored = input.store.get(key)
    if (stored) {
      rows.push(stored)
      continue
    }
    const fallback = input.fallbackRows.find((row) => prospectSearchPeopleSelectionKey(row) === key)
    if (fallback) rows.push(fallback)
  }
  return rows.sort((a, b) => b.confidence - a.confidence)
}
