/** GE-AIOS-17C — Server-side organizational knowledge repository (service-role only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchLatestBusinessIntelligenceReport } from "@/lib/growth/business-intelligence/business-intelligence-repository"
import { loadBusinessIntelligenceReviewState } from "@/lib/growth/business-intelligence/business-intelligence-review-service"
import type { BusinessIntelligenceReport } from "@/lib/growth/business-intelligence/business-intelligence-types"
import type { AvaMemoryEvent } from "@/lib/growth/memory/types"
import { buildOrganizationalKnowledge } from "@/lib/growth/memory/knowledge/build-organizational-knowledge"
import { isOrganizationKnowledgeSchemaReady } from "@/lib/growth/memory/knowledge/organization-knowledge-schema-health"
import {
  GROWTH_ORGANIZATION_KNOWLEDGE_MAX_ITEMS,
  GROWTH_ORGANIZATION_KNOWLEDGE_TABLE,
  GROWTH_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER,
  emptyOrganizationalKnowledgeStore,
  type GrowthHomeOrganizationalKnowledgePayload,
  type OrganizationKnowledgePersistResult,
  type OrganizationalKnowledgeItem,
} from "@/lib/growth/memory/knowledge/organization-knowledge-types"
import type { SalesOutcome } from "@/lib/growth/specialists/execution/sales-outcome-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback
}

function metadataRecord(value: unknown): Record<string, string | number | boolean | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const record: Record<string, string | number | boolean | null> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean" || entry === null) {
      record[key] = entry
    }
  }
  return record
}

function mapRowToKnowledgeItem(organizationId: string, row: Record<string, unknown>): OrganizationalKnowledgeItem {
  return {
    knowledge_id: asString(row.knowledge_id),
    organization_id: organizationId,
    source: asString(row.source) as OrganizationalKnowledgeItem["source"],
    specialist: asString(row.specialist) || null,
    category: asString(row.category) as OrganizationalKnowledgeItem["category"],
    finding: asString(row.finding),
    confidence: asNumber(row.confidence, 0),
    supporting_event_count: asNumber(row.supporting_event_count, 0),
    first_observed_at: asString(row.first_observed_at),
    last_confirmed_at: asString(row.last_confirmed_at),
    superseded_by: asString(row.superseded_by) || null,
    active: asBoolean(row.active, true),
    metadata: metadataRecord(row.metadata),
  }
}

function mapKnowledgeItemToRow(item: OrganizationalKnowledgeItem): Record<string, unknown> {
  return {
    knowledge_id: item.knowledge_id,
    organization_id: item.organization_id,
    source: item.source,
    specialist: item.specialist,
    category: item.category,
    finding: item.finding,
    confidence: item.confidence,
    supporting_event_count: item.supporting_event_count,
    first_observed_at: item.first_observed_at,
    last_confirmed_at: item.last_confirmed_at,
    superseded_by: item.superseded_by,
    active: item.active,
    metadata: item.metadata,
    qa_marker: GROWTH_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER,
  }
}

export async function fetchOrganizationKnowledgeStore(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt: string; limit?: number },
): Promise<GrowthHomeOrganizationalKnowledgePayload> {
  const limit = Math.min(input.limit ?? GROWTH_ORGANIZATION_KNOWLEDGE_MAX_ITEMS, GROWTH_ORGANIZATION_KNOWLEDGE_MAX_ITEMS)
  const schemaReady = await isOrganizationKnowledgeSchemaReady(admin).catch(() => false)
  if (!schemaReady) {
    return {
      qaMarker: GROWTH_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER,
      store: emptyOrganizationalKnowledgeStore(input),
      source: "empty",
      degraded: true,
      warning: "organization_knowledge_schema_unavailable",
    }
  }

  const { data, error } = await admin
    .schema("growth")
    .from(GROWTH_ORGANIZATION_KNOWLEDGE_TABLE)
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("active", true)
    .order("last_confirmed_at", { ascending: false })
    .limit(limit)

  if (error) {
    return {
      qaMarker: GROWTH_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER,
      store: emptyOrganizationalKnowledgeStore(input),
      source: "empty",
      degraded: true,
      warning: error.message,
    }
  }

  const items = (data ?? []).map((row) => mapRowToKnowledgeItem(input.organizationId, row as Record<string, unknown>))

  return {
    qaMarker: GROWTH_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER,
    store: {
      organizationId: input.organizationId,
      capturedAt: input.generatedAt,
      items,
    },
    source: items.length > 0 ? "server" : "empty",
    degraded: false,
    warning: null,
  }
}

export async function upsertOrganizationKnowledgeItems(
  admin: SupabaseClient,
  input: { organizationId: string; items: OrganizationalKnowledgeItem[] },
): Promise<OrganizationKnowledgePersistResult> {
  const schemaReady = await isOrganizationKnowledgeSchemaReady(admin).catch(() => false)
  if (!schemaReady || input.items.length === 0) {
    return { upserted: 0, skipped: input.items.length, persistedKnowledgeIds: [] }
  }

  const rows = input.items
    .filter((item) => item.organization_id === input.organizationId && item.finding.trim())
    .map(mapKnowledgeItemToRow)

  if (rows.length === 0) {
    return { upserted: 0, skipped: input.items.length, persistedKnowledgeIds: [] }
  }

  const { error } = await admin
    .schema("growth")
    .from(GROWTH_ORGANIZATION_KNOWLEDGE_TABLE)
    .upsert(rows, { onConflict: "organization_id,knowledge_id", ignoreDuplicates: false })

  if (error) {
    return { upserted: 0, skipped: input.items.length, persistedKnowledgeIds: [] }
  }

  return {
    upserted: rows.length,
    skipped: input.items.length - rows.length,
    persistedKnowledgeIds: rows.map((row) => asString(row.knowledge_id)),
  }
}

async function loadBusinessIntelligenceForKnowledge(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{
  report: BusinessIntelligenceReport | null
  reviewDecisions: Awaited<ReturnType<typeof loadBusinessIntelligenceReviewState>>["decisions"]
}> {
  const record = await fetchLatestBusinessIntelligenceReport(admin, organizationId).catch(() => null)
  if (!record?.report) {
    return { report: null, reviewDecisions: [] }
  }

  const reviewState = await loadBusinessIntelligenceReviewState(admin, {
    organizationId,
    reportId: record.report_id,
    report: record.report,
  }).catch(() => ({ decisions: [], decisionSummaries: {}, progress: null }))

  return {
    report: record.report,
    reviewDecisions: reviewState.decisions,
  }
}

/** Build deterministic knowledge from BI + memory, persist, and return canonical read model. */
export async function buildGrowthHomeOrganizationalKnowledge(input: {
  admin: SupabaseClient
  organizationId: string
  generatedAt: string
  memoryEvents: AvaMemoryEvent[]
  salesOutcomes: SalesOutcome[]
}): Promise<GrowthHomeOrganizationalKnowledgePayload> {
  const existingPayload = await fetchOrganizationKnowledgeStore(input.admin, {
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
  })

  const bi = await loadBusinessIntelligenceForKnowledge(input.admin, input.organizationId)
  const builtItems = buildOrganizationalKnowledge({
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    report: bi.report,
    reviewDecisions: bi.reviewDecisions,
    memoryEvents: input.memoryEvents,
    salesOutcomes: input.salesOutcomes,
    existingItems: existingPayload.store.items,
  })

  await upsertOrganizationKnowledgeItems(input.admin, {
    organizationId: input.organizationId,
    items: builtItems,
  }).catch(() => ({ upserted: 0, skipped: builtItems.length, persistedKnowledgeIds: [] }))

  const serverPayload = await fetchOrganizationKnowledgeStore(input.admin, {
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
  })

  if (serverPayload.degraded && builtItems.length > 0) {
    return {
      ...serverPayload,
      store: {
        organizationId: input.organizationId,
        capturedAt: input.generatedAt,
        items: builtItems,
      },
      source: "empty",
      degraded: true,
      warning: serverPayload.warning ?? "server_knowledge_degraded_using_builder",
    }
  }

  if (serverPayload.store.items.length === 0 && builtItems.length > 0) {
    return {
      ...serverPayload,
      store: {
        organizationId: input.organizationId,
        capturedAt: input.generatedAt,
        items: builtItems,
      },
      source: "empty",
      degraded: serverPayload.degraded,
      warning: serverPayload.warning,
    }
  }

  return serverPayload
}
