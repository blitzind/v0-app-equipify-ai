/** Prospect Search operator status flags (Sprint 5). Client-safe. */

import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthProspectSearchIndexCompany } from "@/lib/growth/prospect-search/prospect-search-index"

export const GROWTH_PROSPECT_SEARCH_STATUS_QA_MARKER =
  "growth-prospect-search-status-v1" as const

export type ProspectSearchCompanyStatusFlags = {
  in_lead_inbox: boolean
  existing_customer: boolean
  existing_prospect: boolean
  already_pushed: boolean
}

export function deriveProspectSearchCompanyStatus(
  row: Pick<
    GrowthProspectSearchCompanyResult | GrowthProspectSearchIndexCompany,
    | "source_type"
    | "lead_inbox_id"
    | "customer_id"
    | "prospect_id"
    | "existing_account"
    | "signals"
  >,
): ProspectSearchCompanyStatusFlags {
  const in_lead_inbox =
    row.source_type === "lead_inbox" ||
    Boolean(row.lead_inbox_id) ||
    row.signals.some((signal) => /lead inbox/i.test(signal))

  const existing_customer =
    row.source_type === "crm_customer" ||
    Boolean(row.customer_id) ||
    row.signals.some((signal) => /existing crm customer/i.test(signal))

  const existing_prospect =
    row.source_type === "crm_prospect" ||
    Boolean(row.prospect_id) ||
    row.signals.some((signal) => /existing crm prospect/i.test(signal))

  const already_pushed = in_lead_inbox || row.signals.some((signal) => /existing lead inbox/i.test(signal))

  return {
    in_lead_inbox,
    existing_customer,
    existing_prospect,
    already_pushed,
  }
}

export function formatSuppressionReason(reason: string | null | undefined): string | null {
  if (!reason?.trim()) return null
  const labels: Record<string, string> = {
    unsubscribe: "Unsubscribed",
    bounce_hard: "Hard bounce",
    spam_complaint: "Spam complaint",
    manual: "Manual suppression",
    legal: "Legal hold",
  }
  return labels[reason] ?? reason.replace(/_/g, " ")
}
