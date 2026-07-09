/** GE-AIOS-17B — Server-side organizational memory repository (service-role only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  AvaMemoryEvent,
  AvaMemoryEventSource,
  AvaOrganizationalMemoryStore,
  AvaOrganizationalPreference,
} from "@/lib/growth/memory/types"
import { mergeOrganizationalMemoryStore } from "@/lib/growth/memory/storage/organization-memory-store"
import { isOrganizationMemorySchemaReady } from "@/lib/growth/memory/storage/organization-memory-schema-health"
import {
  GROWTH_ORGANIZATION_MEMORY_EVENTS_TABLE,
  GROWTH_ORGANIZATION_MEMORY_MAX_EVENTS,
  GROWTH_ORGANIZATION_MEMORY_MAX_PREFERENCES,
  GROWTH_ORGANIZATION_MEMORY_PREFERENCES_TABLE,
  GROWTH_SERVER_ORG_MEMORY_QA_MARKER,
  emptyOrganizationMemoryStore,
  type GrowthHomeOrganizationMemoryPayload,
  type OrganizationMemoryPersistResult,
} from "@/lib/growth/memory/storage/organization-memory-types"
import type { SalesOutcome } from "@/lib/growth/specialists/execution/sales-outcome-types"
import { extractSalesOutcomeMemoryEvents } from "@/lib/growth/specialists/execution/sales-specialist-memory-bridge"
import { SALES_SPECIALIST_MEMORY_SOURCE } from "@/lib/growth/specialists/execution/sales-specialist-memory-bridge"

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

function mapRowToMemoryEvent(organizationId: string, row: Record<string, unknown>): AvaMemoryEvent {
  return {
    id: asString(row.memory_event_id),
    category: asString(row.category) as AvaMemoryEvent["category"],
    timestamp: asString(row.occurred_at),
    importance: asNumber(row.importance, 3),
    organizationId,
    entityType: asString(row.entity_type) as AvaMemoryEvent["entityType"],
    entityId: asString(row.entity_id),
    source: asString(row.event_source) as AvaMemoryEventSource,
    summary: asString(row.summary),
    metadata: metadataRecord(row.metadata),
  }
}

function mapRowToPreference(row: Record<string, unknown>): AvaOrganizationalPreference {
  return {
    id: asString(row.preference_id),
    key: asString(row.preference_key),
    statement: asString(row.statement),
    importance: asNumber(row.importance, 3),
    source: asString(row.source) as AvaOrganizationalPreference["source"],
    capturedAt: asString(row.captured_at),
  }
}

function mapMemoryEventToRow(event: AvaMemoryEvent): Record<string, unknown> {
  const specialist =
    event.source === SALES_SPECIALIST_MEMORY_SOURCE
      ? "sales"
      : typeof event.metadata.specialist === "string"
        ? event.metadata.specialist
        : null
  const eventType =
    typeof event.metadata.outcome_type === "string" ? event.metadata.outcome_type : event.category

  return {
    memory_event_id: event.id,
    organization_id: event.organizationId,
    category: event.category,
    event_source: event.source,
    specialist,
    event_type: eventType,
    entity_type: event.entityType,
    entity_id: event.entityId,
    summary: event.summary,
    confidence:
      typeof event.metadata.confidence === "number"
        ? event.metadata.confidence
        : typeof event.metadata.confidence === "string"
          ? Number(event.metadata.confidence)
          : null,
    importance: event.importance,
    occurred_at: event.timestamp,
    metadata: event.metadata,
    narrative_visibility: event.metadata.narrative_visibility !== false,
    expires_at: null,
    qa_marker: GROWTH_SERVER_ORG_MEMORY_QA_MARKER,
  }
}

function mapPreferenceToRow(preference: AvaOrganizationalPreference, organizationId: string): Record<string, unknown> {
  return {
    preference_id: preference.id,
    organization_id: organizationId,
    preference_key: preference.key,
    statement: preference.statement,
    importance: preference.importance,
    source: preference.source,
    captured_at: preference.capturedAt,
    qa_marker: GROWTH_SERVER_ORG_MEMORY_QA_MARKER,
  }
}

export async function fetchOrganizationMemoryStore(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt: string; limit?: number },
): Promise<GrowthHomeOrganizationMemoryPayload> {
  const limit = Math.min(input.limit ?? GROWTH_ORGANIZATION_MEMORY_MAX_EVENTS, GROWTH_ORGANIZATION_MEMORY_MAX_EVENTS)
  const schemaReady = await isOrganizationMemorySchemaReady(admin).catch(() => false)
  if (!schemaReady) {
    return {
      qaMarker: GROWTH_SERVER_ORG_MEMORY_QA_MARKER,
      store: emptyOrganizationMemoryStore(input),
      source: "empty",
      degraded: true,
      warning: "organization_memory_schema_unavailable",
    }
  }

  const [eventsResult, preferencesResult] = await Promise.all([
    admin
      .schema("growth")
      .from(GROWTH_ORGANIZATION_MEMORY_EVENTS_TABLE)
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("narrative_visibility", true)
      .order("occurred_at", { ascending: false })
      .limit(limit),
    admin
      .schema("growth")
      .from(GROWTH_ORGANIZATION_MEMORY_PREFERENCES_TABLE)
      .select("*")
      .eq("organization_id", input.organizationId)
      .order("captured_at", { ascending: false })
      .limit(GROWTH_ORGANIZATION_MEMORY_MAX_PREFERENCES),
  ])

  if (eventsResult.error) {
    return {
      qaMarker: GROWTH_SERVER_ORG_MEMORY_QA_MARKER,
      store: emptyOrganizationMemoryStore(input),
      source: "empty",
      degraded: true,
      warning: eventsResult.error.message,
    }
  }

  const events = (eventsResult.data ?? [])
    .map((row) => mapRowToMemoryEvent(input.organizationId, row as Record<string, unknown>))
    .reverse()

  const preferences = (preferencesResult.data ?? []).map((row) =>
    mapRowToPreference(row as Record<string, unknown>),
  )

  return {
    qaMarker: GROWTH_SERVER_ORG_MEMORY_QA_MARKER,
    store: {
      organizationId: input.organizationId,
      capturedAt: input.generatedAt,
      events,
      preferences,
    },
    source: events.length > 0 || preferences.length > 0 ? "server" : "empty",
    degraded: Boolean(preferencesResult.error),
    warning: preferencesResult.error?.message ?? null,
  }
}

export async function upsertOrganizationMemoryEvents(
  admin: SupabaseClient,
  input: { organizationId: string; events: AvaMemoryEvent[] },
): Promise<OrganizationMemoryPersistResult> {
  const schemaReady = await isOrganizationMemorySchemaReady(admin).catch(() => false)
  if (!schemaReady || input.events.length === 0) {
    return { inserted: 0, skipped: input.events.length, persistedEventIds: [] }
  }

  const rows = input.events
    .filter((event) => event.organizationId === input.organizationId && event.summary.trim())
    .map(mapMemoryEventToRow)

  if (rows.length === 0) {
    return { inserted: 0, skipped: input.events.length, persistedEventIds: [] }
  }

  const { error } = await admin
    .schema("growth")
    .from(GROWTH_ORGANIZATION_MEMORY_EVENTS_TABLE)
    .upsert(rows, { onConflict: "organization_id,memory_event_id", ignoreDuplicates: true })

  if (error) {
    return { inserted: 0, skipped: input.events.length, persistedEventIds: [] }
  }

  return {
    inserted: rows.length,
    skipped: input.events.length - rows.length,
    persistedEventIds: rows.map((row) => asString(row.memory_event_id)),
  }
}

export async function upsertOrganizationMemoryPreferences(
  admin: SupabaseClient,
  input: { organizationId: string; preferences: AvaOrganizationalPreference[] },
): Promise<number> {
  const schemaReady = await isOrganizationMemorySchemaReady(admin).catch(() => false)
  if (!schemaReady || input.preferences.length === 0) return 0

  const rows = input.preferences.map((preference) => mapPreferenceToRow(preference, input.organizationId))
  const { error } = await admin
    .schema("growth")
    .from(GROWTH_ORGANIZATION_MEMORY_PREFERENCES_TABLE)
    .upsert(rows, { onConflict: "organization_id,preference_id", ignoreDuplicates: false })

  return error ? 0 : rows.length
}

/** Persist only Sales Specialist validated memory events — never raw agent telemetry. */
export async function persistValidatedSalesOutcomeMemoryEvents(
  admin: SupabaseClient,
  input: { organizationId: string; outcomes: SalesOutcome[] },
): Promise<OrganizationMemoryPersistResult> {
  const events = extractSalesOutcomeMemoryEvents(input.outcomes).filter(
    (event) => event.source === SALES_SPECIALIST_MEMORY_SOURCE && event.organizationId === input.organizationId,
  )
  return upsertOrganizationMemoryEvents(admin, {
    organizationId: input.organizationId,
    events,
  })
}

export async function buildGrowthHomeOrganizationMemory(input: {
  admin: SupabaseClient
  organizationId: string
  generatedAt: string
  salesOutcomes: SalesOutcome[]
  fallbackStore?: AvaOrganizationalMemoryStore | null
}): Promise<GrowthHomeOrganizationMemoryPayload> {
  await persistValidatedSalesOutcomeMemoryEvents(input.admin, {
    organizationId: input.organizationId,
    outcomes: input.salesOutcomes,
  }).catch(() => ({ inserted: 0, skipped: input.salesOutcomes.length, persistedEventIds: [] }))

  const serverPayload = await fetchOrganizationMemoryStore(input.admin, {
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
  })

  if (input.fallbackStore && serverPayload.degraded) {
    return {
      ...serverPayload,
      store: mergeOrganizationalMemoryStore(input.fallbackStore, serverPayload.store),
      source: "empty",
      degraded: true,
      warning: serverPayload.warning ?? "server_memory_degraded_using_fallback",
    }
  }

  return serverPayload
}
