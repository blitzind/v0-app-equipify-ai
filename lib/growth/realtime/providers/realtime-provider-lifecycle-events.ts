import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { RealtimeProviderLifecycleEventType } from "@/lib/growth/realtime/providers/realtime-provider-readiness-types"

export type RealtimeProviderLifecycleEvent = {
  id: string
  connectionId: string | null
  sessionId: string | null
  eventType: RealtimeProviderLifecycleEventType
  message: string
  metadata: Record<string, unknown>
  createdAt: string
}

const SECRET_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i

function sanitizeLifecycleMessage(message: string): string {
  return message.replace(/Token\s+\S+/gi, "Token [redacted]").slice(0, 500)
}

function sanitizeLifecycleMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (SECRET_PATTERN.test(key)) continue
    if (typeof value === "string" && SECRET_PATTERN.test(value)) continue
    next[key] = value
  }
  return next
}

function table(admin: SupabaseClient) {
  return admin.schema("growth").from("realtime_provider_lifecycle_events")
}

export async function appendRealtimeProviderLifecycleEvent(
  admin: SupabaseClient,
  input: {
    connectionId?: string | null
    sessionId?: string | null
    eventType: RealtimeProviderLifecycleEventType
    message: string
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await table(admin).insert({
    connection_id: input.connectionId ?? null,
    session_id: input.sessionId ?? null,
    event_type: input.eventType,
    message: sanitizeLifecycleMessage(input.message),
    metadata: sanitizeLifecycleMetadata(input.metadata ?? {}),
  })
  if (error) throw new Error(error.message)
}

export async function listRecentRealtimeProviderLifecycleEvents(
  admin: SupabaseClient,
  input: { connectionId?: string; limit?: number },
): Promise<RealtimeProviderLifecycleEvent[]> {
  let query = table(admin)
    .select("id, connection_id, session_id, event_type, message, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 20)

  if (input.connectionId) {
    query = query.eq("connection_id", input.connectionId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    id: row.id as string,
    connectionId: (row.connection_id as string | null) ?? null,
    sessionId: (row.session_id as string | null) ?? null,
    eventType: row.event_type as RealtimeProviderLifecycleEventType,
    message: row.message as string,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
  }))
}

export function countLifecycleEventsByType(
  events: RealtimeProviderLifecycleEvent[],
): Partial<Record<RealtimeProviderLifecycleEventType, number>> {
  const counts: Partial<Record<RealtimeProviderLifecycleEventType, number>> = {}
  for (const event of events) {
    counts[event.eventType] = (counts[event.eventType] ?? 0) + 1
  }
  return counts
}
