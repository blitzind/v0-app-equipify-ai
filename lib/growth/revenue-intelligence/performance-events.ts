import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthPerformanceIntelligenceEvent } from "@/lib/growth/revenue-intelligence/revenue-intelligence-types"

type Row = Record<string, unknown>

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("performance_intelligence_events")
}

function platformTimelineTable(admin: SupabaseClient) {
  return admin.schema("growth").from("platform_timeline_events")
}

export async function insertPerformanceIntelligenceEvent(
  admin: SupabaseClient,
  input: {
    eventType: string
    title: string
    description?: string
    severity?: GrowthPerformanceIntelligenceEvent["severity"]
    entityType?: string | null
    entityId?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<GrowthPerformanceIntelligenceEvent> {
  const { data, error } = await eventsTable(admin)
    .insert({
      event_type: input.eventType,
      severity: input.severity ?? "info",
      title: input.title.slice(0, 200),
      description: (input.description ?? "").slice(0, 500),
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  const row = data as Row
  return {
    id: String(row.id),
    eventType: String(row.event_type),
    severity: row.severity as GrowthPerformanceIntelligenceEvent["severity"],
    title: String(row.title),
    description: String(row.description),
    entityType: row.entity_type ? String(row.entity_type) : null,
    entityId: row.entity_id ? String(row.entity_id) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  }
}

export async function recordPerformancePlatformTimeline(
  admin: SupabaseClient,
  input: {
    eventType: string
    title: string
    summary?: string
    payload?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await platformTimelineTable(admin).insert({
    connection_id: null,
    event_type: input.eventType,
    title: input.title.slice(0, 200),
    summary: input.summary?.slice(0, 500) ?? null,
    payload: { ...(input.payload ?? {}), source: "growth_revenue_sequence_intelligence" },
  })
  if (error) throw new Error(error.message)
}

export async function listPerformanceIntelligenceEvents(
  admin: SupabaseClient,
  limit = 50,
): Promise<GrowthPerformanceIntelligenceEvent[]> {
  const { data, error } = await eventsTable(admin)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const record = row as Row
    return {
      id: String(record.id),
      eventType: String(record.event_type),
      severity: record.severity as GrowthPerformanceIntelligenceEvent["severity"],
      title: String(record.title),
      description: String(record.description),
      entityType: record.entity_type ? String(record.entity_type) : null,
      entityId: record.entity_id ? String(record.entity_id) : null,
      metadata: (record.metadata as Record<string, unknown>) ?? {},
      createdAt: String(record.created_at),
    }
  })
}

export async function recordPerformanceRiskEvent(
  admin: SupabaseClient,
  input: {
    eventType: string
    title: string
    description: string
    severity: GrowthPerformanceIntelligenceEvent["severity"]
    entityType: string
    entityId?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  await insertPerformanceIntelligenceEvent(admin, input)
  await recordPerformancePlatformTimeline(admin, {
    eventType: "performance_risk_detected",
    title: input.title,
    summary: input.description,
    payload: { risk_type: input.eventType, entity_type: input.entityType, entity_id: input.entityId ?? null },
  }).catch(() => undefined)
}
