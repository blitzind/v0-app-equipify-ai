/**
 * GE-LEADS-CANONICAL-3A — Compare legacy lead_inbox queue vs canonical growth.leads projection.
 * Used for production certification before Revenue Queue UI flip.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById, listGrowthLeads } from "@/lib/growth/lead-repository"
import { loadLeadInbox } from "@/lib/growth/lead-inbox/lead-inbox-repository"
import { GROWTH_LEAD_INBOX_METADATA_GROWTH_LEAD_ID } from "@/lib/growth/lead-inbox/lead-inbox-canonical-intake-bridge"
import { buildLeadInboxCardView } from "@/lib/growth/lead-operator-workspace/lead-inbox-card-view"
import type { GrowthLeadInboxCardView } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import {
  REVENUE_QUEUE_CARD_PARITY_FIELDS,
  REVENUE_QUEUE_MISSING_PROJECTION_DEPENDENCIES,
  type RevenueQueueCardParityField,
} from "@/lib/growth/revenue-queue/revenue-queue-field-compatibility"
import { buildRevenueQueueLeadProjection } from "@/lib/growth/revenue-queue/revenue-queue-projection"
import {
  GROWTH_REVENUE_QUEUE_PROJECTION_CERT_QA_MARKER,
  type RevenueQueueProjectionCertReport,
  type RevenueQueueProjectionFieldParity,
  type RevenueQueueProjectionCertRecord,
} from "@/lib/growth/revenue-queue/revenue-queue-projection-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function readGrowthLeadIdFromInboxMetadata(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) return null
  return asString(metadata[GROWTH_LEAD_INBOX_METADATA_GROWTH_LEAD_ID]) || null
}

function readCardField(card: GrowthLeadInboxCardView, field: RevenueQueueCardParityField): unknown {
  return card[field]
}

function valuesMatch(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null && b == null) return true
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) < 0.001
  }
  return String(a) === String(b)
}

function compareCardParity(
  legacy: GrowthLeadInboxCardView,
  canonical: GrowthLeadInboxCardView,
): RevenueQueueProjectionFieldParity[] {
  return REVENUE_QUEUE_CARD_PARITY_FIELDS.map((field) => {
    const legacyValue = readCardField(legacy, field)
    const canonicalValue = readCardField(canonical, field)
    const legacyPresent = legacyValue != null && legacyValue !== ""
    const canonicalPresent = canonicalValue != null && canonicalValue !== ""
    return {
      field,
      legacy_present: legacyPresent,
      canonical_present: canonicalPresent,
      match: valuesMatch(legacyValue, canonicalValue),
      legacy_value:
        typeof legacyValue === "string" ||
        typeof legacyValue === "number" ||
        typeof legacyValue === "boolean"
          ? legacyValue
          : null,
      canonical_value:
        typeof canonicalValue === "string" ||
        typeof canonicalValue === "number" ||
        typeof canonicalValue === "boolean"
          ? canonicalValue
          : null,
    }
  })
}

export async function certifyRevenueQueueProjectionParity(
  admin: SupabaseClient,
  input?: { inboxLimit?: number; leadsLimit?: number },
): Promise<RevenueQueueProjectionCertReport> {
  const inboxLimit = Math.min(Math.max(input?.inboxLimit ?? 200, 1), 500)
  const leadsLimit = Math.min(Math.max(input?.leadsLimit ?? 200, 1), 500)

  const [inboxResult, leads] = await Promise.all([
    loadLeadInbox(admin, { limit: inboxLimit }),
    listGrowthLeads(admin, { limit: leadsLimit, includeArchived: true }),
  ])

  const canonicalByLeadId = new Map(
    leads.map((lead) => [lead.id, buildRevenueQueueLeadProjection(lead)]),
  )
  const linkedLeadIds = new Set<string>()
  const records: RevenueQueueProjectionCertRecord[] = []
  const orphanLegacyInboxIds: string[] = []

  for (const row of inboxResult.items) {
    const growthLeadId = readGrowthLeadIdFromInboxMetadata(row.metadata)
    const legacyCard = buildLeadInboxCardView(row)

    if (!growthLeadId) {
      orphanLegacyInboxIds.push(row.id)
      records.push({
        legacy_inbox_id: row.id,
        growth_lead_id: "",
        linked_via_metadata: false,
        field_parity: [],
        missing_canonical_fields: ["growth_lead_id"],
        missing_legacy_record: true,
      })
      continue
    }

    linkedLeadIds.add(growthLeadId)
    let canonical = canonicalByLeadId.get(growthLeadId)
    if (!canonical) {
      const fetched = await fetchGrowthLeadById(admin, growthLeadId)
      if (fetched) {
        canonical = buildRevenueQueueLeadProjection(fetched)
        canonicalByLeadId.set(growthLeadId, canonical)
      }
    }

    if (!canonical) {
      records.push({
        legacy_inbox_id: row.id,
        growth_lead_id: growthLeadId,
        linked_via_metadata: true,
        field_parity: [],
        missing_canonical_fields: ["growth.leads row missing"],
        missing_legacy_record: false,
      })
      continue
    }

    records.push({
      legacy_inbox_id: row.id,
      growth_lead_id: growthLeadId,
      linked_via_metadata: true,
      field_parity: compareCardParity(legacyCard, canonical.card_view),
      missing_canonical_fields: canonical.missing_projection_fields,
      missing_legacy_record: false,
    })
  }

  const orphanCanonicalLeadIds = [...canonicalByLeadId.keys()].filter((id) => !linkedLeadIds.has(id))

  let fullyMatching = 0
  let withGaps = 0
  for (const record of records) {
    if (!record.linked_via_metadata || record.field_parity.length === 0) {
      withGaps += 1
      continue
    }
    const allMatch = record.field_parity.every((f) => f.match)
    if (allMatch) fullyMatching += 1
    else withGaps += 1
  }

  return {
    qa_marker: GROWTH_REVENUE_QUEUE_PROJECTION_CERT_QA_MARKER,
    generated_at: new Date().toISOString(),
    legacy_inbox_total: inboxResult.total,
    canonical_projection_total: canonicalByLeadId.size,
    matching_linked_records: records.filter((r) => r.linked_via_metadata).length,
    legacy_without_canonical_link: orphanLegacyInboxIds.length,
    canonical_without_legacy_inbox: orphanCanonicalLeadIds.length,
    field_parity_summary: {
      compared_fields: REVENUE_QUEUE_CARD_PARITY_FIELDS.length,
      fully_matching_records: fullyMatching,
      records_with_gaps: withGaps,
    },
    missing_projection_dependencies: REVENUE_QUEUE_MISSING_PROJECTION_DEPENDENCIES.map((d) => d.field),
    records: records.slice(0, 50),
    orphan_legacy_inbox_ids: orphanLegacyInboxIds.slice(0, 25),
    orphan_canonical_lead_ids: orphanCanonicalLeadIds.slice(0, 25),
  }
}
