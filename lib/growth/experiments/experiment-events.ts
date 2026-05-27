import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthSequenceExperimentEvent } from "@/lib/growth/experiments/experiment-types"

type Row = Record<string, unknown>

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sequence_experiment_events")
}

function platformTimelineTable(admin: SupabaseClient) {
  return admin.schema("growth").from("platform_timeline_events")
}

export async function insertSequenceExperimentEvent(
  admin: SupabaseClient,
  input: {
    experimentId: string
    variantId?: string | null
    eventType: string
    title: string
    description?: string
    severity?: GrowthSequenceExperimentEvent["severity"]
    metadata?: Record<string, unknown>
  },
): Promise<GrowthSequenceExperimentEvent> {
  const { data, error } = await eventsTable(admin)
    .insert({
      experiment_id: input.experimentId,
      variant_id: input.variantId ?? null,
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
    experimentId: String(row.experiment_id),
    variantId: row.variant_id ? String(row.variant_id) : null,
    eventType: String(row.event_type),
    severity: row.severity as GrowthSequenceExperimentEvent["severity"],
    title: String(row.title),
    description: String(row.description),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  }
}

export async function recordSequenceExperimentPlatformTimeline(
  admin: SupabaseClient,
  input: {
    eventType: string
    title: string
    summary?: string
    experimentId: string
    variantId?: string | null
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
      experiment_id: input.experimentId,
      variant_id: input.variantId ?? null,
      source: "growth_sequence_ab_testing",
    },
  })
  if (error) throw new Error(error.message)
}

export async function listSequenceExperimentEvents(
  admin: SupabaseClient,
  experimentId: string,
  limit = 50,
): Promise<GrowthSequenceExperimentEvent[]> {
  const { data, error } = await eventsTable(admin)
    .select("*")
    .eq("experiment_id", experimentId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const record = row as Row
    return {
      id: String(record.id),
      experimentId: String(record.experiment_id),
      variantId: record.variant_id ? String(record.variant_id) : null,
      eventType: String(record.event_type),
      severity: record.severity as GrowthSequenceExperimentEvent["severity"],
      title: String(record.title),
      description: String(record.description),
      metadata: (record.metadata as Record<string, unknown>) ?? {},
      createdAt: String(record.created_at),
    }
  })
}
