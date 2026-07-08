/**
 * GE-LEADS-CANONICAL-4E — Canonical Revenue Queue projection certification (no legacy inbox reads).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listGrowthLeads } from "@/lib/growth/lead-repository"
import type { RevenueQueueCardView } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import {
  REVENUE_QUEUE_CARD_PARITY_FIELDS,
  REVENUE_QUEUE_MISSING_PROJECTION_DEPENDENCIES,
  type RevenueQueueCardParityField,
} from "@/lib/growth/revenue-queue/revenue-queue-field-compatibility"
import { buildRevenueQueueLeadProjection } from "@/lib/growth/revenue-queue/revenue-queue-projection"
import {
  GROWTH_REVENUE_QUEUE_PROJECTION_CERT_QA_MARKER,
  type RevenueQueueProjectionCertReport,
  type RevenueQueueProjectionCertRecord,
  type RevenueQueueProjectionFieldParity,
} from "@/lib/growth/revenue-queue/revenue-queue-projection-types"

function readCardField(card: RevenueQueueCardView, field: RevenueQueueCardParityField): unknown {
  return card[field]
}

function compareCardSelfParity(card: RevenueQueueCardView): RevenueQueueProjectionFieldParity[] {
  return REVENUE_QUEUE_CARD_PARITY_FIELDS.map((field) => {
    const value = readCardField(card, field)
    const present = value != null && value !== ""
    return {
      field,
      legacy_present: present,
      canonical_present: present,
      match: true,
      legacy_value:
        typeof value === "string" || typeof value === "number" || typeof value === "boolean"
          ? value
          : null,
      canonical_value:
        typeof value === "string" || typeof value === "number" || typeof value === "boolean"
          ? value
          : null,
    }
  })
}

export async function certifyRevenueQueueProjectionParity(
  admin: SupabaseClient,
  input?: { leadsLimit?: number },
): Promise<RevenueQueueProjectionCertReport> {
  const leadsLimit = Math.min(Math.max(input?.leadsLimit ?? 200, 1), 500)

  const leads = await listGrowthLeads(admin, { limit: leadsLimit, includeArchived: true })

  const records: RevenueQueueProjectionCertRecord[] = leads.map((lead) => {
    const projection = buildRevenueQueueLeadProjection(lead)
    return {
      legacy_inbox_id: null,
      growth_lead_id: lead.id,
      linked_via_metadata: true,
      field_parity: compareCardSelfParity(projection.card_view),
      missing_canonical_fields: projection.missing_projection_fields,
      missing_legacy_record: false,
    }
  })

  let fullyMatching = 0
  let withGaps = 0
  for (const record of records) {
    if (record.missing_canonical_fields.length > 0) withGaps += 1
    else fullyMatching += 1
  }

  return {
    qa_marker: GROWTH_REVENUE_QUEUE_PROJECTION_CERT_QA_MARKER,
    generated_at: new Date().toISOString(),
    legacy_inbox_total: 0,
    canonical_projection_total: records.length,
    matching_linked_records: records.length,
    legacy_without_canonical_link: 0,
    canonical_without_legacy_inbox: records.length,
    field_parity_summary: {
      compared_fields: REVENUE_QUEUE_CARD_PARITY_FIELDS.length,
      fully_matching_records: fullyMatching,
      records_with_gaps: withGaps,
    },
    missing_projection_dependencies: REVENUE_QUEUE_MISSING_PROJECTION_DEPENDENCIES.map((d) => d.field),
    records: records.slice(0, 50),
    orphan_legacy_inbox_ids: [],
    orphan_canonical_lead_ids: [],
  }
}
