import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthCrmIntelligenceEvent } from "@/lib/growth/opportunity-intelligence/opportunity-types"

type Row = Record<string, unknown>

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("crm_intelligence_events")
}

function platformTimelineTable(admin: SupabaseClient) {
  return admin.schema("growth").from("platform_timeline_events")
}

export async function insertCrmIntelligenceEvent(
  admin: SupabaseClient,
  input: {
    leadId?: string | null
    recommendationId?: string | null
    signalId?: string | null
    eventType: string
    title: string
    description?: string
    severity?: GrowthCrmIntelligenceEvent["severity"]
    metadata?: Record<string, unknown>
  },
): Promise<GrowthCrmIntelligenceEvent> {
  const { data, error } = await eventsTable(admin)
    .insert({
      lead_id: input.leadId ?? null,
      recommendation_id: input.recommendationId ?? null,
      signal_id: input.signalId ?? null,
      event_type: input.eventType,
      severity: input.severity ?? "info",
      title: input.title.slice(0, 200),
      description: (input.description ?? "").slice(0, 500),
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  const row = data as Row
  return {
    id: String(row.id),
    leadId: row.lead_id ? String(row.lead_id) : null,
    recommendationId: row.recommendation_id ? String(row.recommendation_id) : null,
    signalId: row.signal_id ? String(row.signal_id) : null,
    eventType: String(row.event_type),
    severity: row.severity as GrowthCrmIntelligenceEvent["severity"],
    title: String(row.title),
    description: String(row.description),
    createdAt: String(row.created_at),
  }
}

export async function recordOpportunityIntelligencePlatformTimeline(
  admin: SupabaseClient,
  input: {
    eventType: string
    title: string
    summary?: string
    leadId?: string | null
    payload?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await platformTimelineTable(admin).insert({
    connection_id: null,
    event_type: input.eventType,
    title: input.title.slice(0, 200),
    summary: input.summary?.slice(0, 500) ?? null,
    payload: {
      ...(input.payload ?? {}),
      lead_id: input.leadId ?? null,
      source: "growth_opportunity_intelligence",
    },
  })
  if (error) throw new Error(error.message)
}

export async function listCrmIntelligenceEvents(
  admin: SupabaseClient,
  input?: { leadId?: string; limit?: number },
): Promise<GrowthCrmIntelligenceEvent[]> {
  let query = eventsTable(admin).select("*").order("created_at", { ascending: false }).limit(input?.limit ?? 50)
  if (input?.leadId) query = query.eq("lead_id", input.leadId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const record = row as Row
    return {
      id: String(record.id),
      leadId: record.lead_id ? String(record.lead_id) : null,
      recommendationId: record.recommendation_id ? String(record.recommendation_id) : null,
      signalId: record.signal_id ? String(record.signal_id) : null,
      eventType: String(record.event_type),
      severity: record.severity as GrowthCrmIntelligenceEvent["severity"],
      title: String(record.title),
      description: String(record.description),
      createdAt: String(record.created_at),
    }
  })
}
