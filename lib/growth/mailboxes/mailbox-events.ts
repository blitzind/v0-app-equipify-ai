import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthMailboxConnectionEvent,
  GrowthMailboxEventSeverity,
  GrowthMailboxTimelineEventType,
} from "@/lib/growth/mailboxes/mailbox-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("mailbox_connection_events")
}

function timelineTable(admin: SupabaseClient) {
  return admin.schema("growth").from("platform_timeline_events")
}

function mapEvent(row: Record<string, unknown>): GrowthMailboxConnectionEvent {
  return {
    id: asString(row.id),
    mailbox_connection_id: asString(row.mailbox_connection_id),
    event_type: asString(row.event_type) || "health_check",
    severity: asString(row.severity) as GrowthMailboxEventSeverity,
    title: asString(row.title),
    description: asString(row.description),
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {},
    created_at: asString(row.created_at),
  }
}

export async function createMailboxConnectionEvent(
  admin: SupabaseClient,
  input: {
    mailbox_connection_id: string
    event_type: string
    severity: GrowthMailboxEventSeverity
    title: string
    description: string
    metadata?: Record<string, unknown>
  },
): Promise<GrowthMailboxConnectionEvent> {
  const { data, error } = await eventsTable(admin)
    .insert({
      mailbox_connection_id: input.mailbox_connection_id,
      event_type: input.event_type,
      severity: input.severity,
      title: input.title,
      description: input.description,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapEvent(data as Record<string, unknown>)
}

export async function listMailboxConnectionEvents(
  admin: SupabaseClient,
  input?: { limit?: number; mailbox_connection_id?: string },
): Promise<GrowthMailboxConnectionEvent[]> {
  let query = eventsTable(admin).select("*").order("created_at", { ascending: false }).limit(input?.limit ?? 50)
  if (input?.mailbox_connection_id) {
    query = query.eq("mailbox_connection_id", input.mailbox_connection_id)
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapEvent(row as Record<string, unknown>))
}

export async function appendMailboxTimelineEvent(
  admin: SupabaseClient,
  input: {
    eventType: GrowthMailboxTimelineEventType
    title: string
    summary?: string | null
    mailboxConnectionId?: string | null
    payload?: Record<string, unknown>
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<void> {
  const { error } = await timelineTable(admin).insert({
    connection_id: null,
    event_type: input.eventType,
    title: input.title,
    summary: input.summary ?? null,
    payload: {
      ...(input.payload ?? {}),
      mailbox_connection_id: input.mailboxConnectionId ?? null,
    },
    actor_user_id: input.actorUserId ?? null,
    actor_email: input.actorEmail ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function listMailboxTimelineEvents(
  admin: SupabaseClient,
  input?: { limit?: number },
): Promise<
  Array<{
    id: string
    event_type: GrowthMailboxTimelineEventType
    title: string
    summary: string | null
    payload: Record<string, unknown>
    occurred_at: string
  }>
> {
  const { data, error } = await timelineTable(admin)
    .select("id, event_type, title, summary, payload, occurred_at")
    .in("event_type", [
      "mailbox_connected",
      "mailbox_disconnected",
      "mailbox_validation_failed",
      "mailbox_token_expired",
      "mailbox_health_declined",
    ])
    .order("occurred_at", { ascending: false })
    .limit(input?.limit ?? 30)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    return {
      id: asString(r.id),
      event_type: asString(r.event_type) as GrowthMailboxTimelineEventType,
      title: asString(r.title),
      summary: asString(r.summary) || null,
      payload: r.payload && typeof r.payload === "object" ? (r.payload as Record<string, unknown>) : {},
      occurred_at: asString(r.occurred_at),
    }
  })
}
