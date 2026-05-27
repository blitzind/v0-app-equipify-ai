import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthSenderHealthEvent,
  GrowthSenderHealthEventSeverity,
  GrowthSenderTimelineEventType,
} from "@/lib/growth/sender/sender-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function healthEventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sender_health_events")
}

function timelineTable(admin: SupabaseClient) {
  return admin.schema("growth").from("platform_timeline_events")
}

function mapHealthEvent(row: Record<string, unknown>): GrowthSenderHealthEvent {
  return {
    id: asString(row.id),
    sender_account_id: asString(row.sender_account_id) || null,
    domain_id: asString(row.domain_id) || null,
    event_type: asString(row.event_type) || "health_check",
    severity: asString(row.severity) as GrowthSenderHealthEventSeverity,
    title: asString(row.title),
    description: asString(row.description),
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {},
    resolved: Boolean(row.resolved),
    resolved_at: asString(row.resolved_at) || null,
    created_at: asString(row.created_at),
  }
}

export async function createSenderHealthEvent(
  admin: SupabaseClient,
  input: {
    sender_account_id?: string | null
    domain_id?: string | null
    event_type: string
    severity: GrowthSenderHealthEventSeverity
    title: string
    description: string
    metadata?: Record<string, unknown>
  },
): Promise<GrowthSenderHealthEvent> {
  const { data, error } = await healthEventsTable(admin)
    .insert({
      sender_account_id: input.sender_account_id ?? null,
      domain_id: input.domain_id ?? null,
      event_type: input.event_type,
      severity: input.severity,
      title: input.title,
      description: input.description,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapHealthEvent(data as Record<string, unknown>)
}

export async function listSenderHealthEvents(
  admin: SupabaseClient,
  input?: { limit?: number; sender_account_id?: string; unresolved_only?: boolean },
): Promise<GrowthSenderHealthEvent[]> {
  let query = healthEventsTable(admin).select("*").order("created_at", { ascending: false }).limit(input?.limit ?? 50)

  if (input?.sender_account_id) {
    query = query.eq("sender_account_id", input.sender_account_id)
  }
  if (input?.unresolved_only) {
    query = query.eq("resolved", false)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapHealthEvent(row as Record<string, unknown>))
}

export async function appendSenderTimelineEvent(
  admin: SupabaseClient,
  input: {
    eventType: GrowthSenderTimelineEventType
    title: string
    summary?: string | null
    senderAccountId?: string | null
    domainId?: string | null
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
      sender_account_id: input.senderAccountId ?? null,
      domain_id: input.domainId ?? null,
    },
    actor_user_id: input.actorUserId ?? null,
    actor_email: input.actorEmail ?? null,
  })

  if (error) throw new Error(error.message)
}

export async function listSenderTimelineEvents(
  admin: SupabaseClient,
  input?: { limit?: number },
): Promise<
  Array<{
    id: string
    event_type: GrowthSenderTimelineEventType
    title: string
    summary: string | null
    payload: Record<string, unknown>
    occurred_at: string
  }>
> {
  const { data, error } = await timelineTable(admin)
    .select("id, event_type, title, summary, payload, occurred_at")
    .in("event_type", [
      "sender_connected",
      "sender_disabled",
      "sender_score_changed",
      "domain_health_declined",
      "domain_validated",
    ])
    .order("occurred_at", { ascending: false })
    .limit(input?.limit ?? 30)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    return {
      id: asString(r.id),
      event_type: asString(r.event_type) as GrowthSenderTimelineEventType,
      title: asString(r.title),
      summary: asString(r.summary) || null,
      payload: r.payload && typeof r.payload === "object" ? (r.payload as Record<string, unknown>) : {},
      occurred_at: asString(r.occurred_at),
    }
  })
}
