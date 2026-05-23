import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthImportBatchEvent, GrowthImportBatchEventType } from "@/lib/growth/import/types"

type EventDbRow = {
  id: string
  batch_id: string
  event_type: string
  title: string
  summary: string | null
  payload: Record<string, unknown>
  actor_user_id: string | null
  actor_email: string | null
  occurred_at: string
  created_at: string
}

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("lead_import_batch_events")
}

function mapEvent(row: EventDbRow): GrowthImportBatchEvent {
  return {
    id: row.id,
    batchId: row.batch_id,
    eventType: row.event_type as GrowthImportBatchEventType,
    title: row.title,
    summary: row.summary,
    payload: row.payload ?? {},
    actorUserId: row.actor_user_id,
    actorEmail: row.actor_email,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  }
}

export async function appendGrowthImportBatchEvent(
  admin: SupabaseClient,
  input: {
    batchId: string
    eventType: GrowthImportBatchEventType
    title: string
    summary?: string | null
    payload?: Record<string, unknown>
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<GrowthImportBatchEvent> {
  const { data, error } = await eventsTable(admin)
    .insert({
      batch_id: input.batchId,
      event_type: input.eventType,
      title: input.title,
      summary: input.summary ?? null,
      payload: input.payload ?? {},
      actor_user_id: input.actorUserId ?? null,
      actor_email: input.actorEmail ?? null,
    })
    .select("id, batch_id, event_type, title, summary, payload, actor_user_id, actor_email, occurred_at, created_at")
    .single()
  if (error) throw new Error(error.message)
  return mapEvent(data as EventDbRow)
}

export async function listGrowthImportBatchEvents(
  admin: SupabaseClient,
  batchId: string,
  input: { limit?: number } = {},
): Promise<GrowthImportBatchEvent[]> {
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500)
  const { data, error } = await eventsTable(admin)
    .select("id, batch_id, event_type, title, summary, payload, actor_user_id, actor_email, occurred_at, created_at")
    .eq("batch_id", batchId)
    .order("occurred_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return ((data ?? []) as EventDbRow[]).map(mapEvent)
}
