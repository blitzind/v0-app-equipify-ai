import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthPlatformProviderEventType,
  GrowthPlatformTimelineEvent,
} from "@/lib/growth/outbound/provider-types"

type PlatformTimelineRow = {
  id: string
  connection_id: string | null
  event_type: string
  title: string
  summary: string | null
  payload: Record<string, unknown> | null
  actor_user_id: string | null
  actor_email: string | null
  occurred_at: string
  created_at: string
}

function table(admin: SupabaseClient) {
  return admin.schema("growth").from("platform_timeline_events")
}

function mapRow(row: PlatformTimelineRow): GrowthPlatformTimelineEvent {
  return {
    id: row.id,
    connectionId: row.connection_id,
    eventType: row.event_type as GrowthPlatformProviderEventType,
    title: row.title,
    summary: row.summary,
    payload: row.payload ?? {},
    actorUserId: row.actor_user_id,
    actorEmail: row.actor_email,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  }
}

export async function appendGrowthPlatformTimelineEvent(
  admin: SupabaseClient,
  input: {
    connectionId?: string | null
    eventType: GrowthPlatformProviderEventType
    title: string
    summary?: string | null
    payload?: Record<string, unknown>
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<GrowthPlatformTimelineEvent> {
  const { data, error } = await table(admin)
    .insert({
      connection_id: input.connectionId ?? null,
      event_type: input.eventType,
      title: input.title,
      summary: input.summary ?? null,
      payload: input.payload ?? {},
      actor_user_id: input.actorUserId ?? null,
      actor_email: input.actorEmail ?? null,
    })
    .select(
      "id, connection_id, event_type, title, summary, payload, actor_user_id, actor_email, occurred_at, created_at",
    )
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data as PlatformTimelineRow)
}

export async function listGrowthPlatformTimelineEvents(
  admin: SupabaseClient,
  input?: { connectionId?: string; limit?: number },
): Promise<GrowthPlatformTimelineEvent[]> {
  let query = table(admin)
    .select(
      "id, connection_id, event_type, title, summary, payload, actor_user_id, actor_email, occurred_at, created_at",
    )
    .order("occurred_at", { ascending: false })
    .limit(input?.limit ?? 50)

  if (input?.connectionId) {
    query = query.eq("connection_id", input.connectionId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as PlatformTimelineRow[]).map(mapRow)
}
