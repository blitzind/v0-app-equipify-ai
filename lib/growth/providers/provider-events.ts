import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthDeliveryEvent,
  GrowthDeliveryEventSeverity,
  GrowthDeliveryTimelineEventType,
} from "@/lib/growth/providers/provider-types"
import type { DeliveryEventDraft } from "@/lib/growth/providers/provider-event-builder"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("delivery_events")
}

function timelineTable(admin: SupabaseClient) {
  return admin.schema("growth").from("platform_timeline_events")
}

function mapEvent(row: Record<string, unknown>, providerName = ""): GrowthDeliveryEvent {
  return {
    id: asString(row.id),
    provider_id: asString(row.provider_id),
    provider_name: providerName,
    severity: asString(row.severity) as GrowthDeliveryEventSeverity,
    event_type: asString(row.event_type) || "health_check",
    title: asString(row.title),
    description: asString(row.description),
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {},
    created_at: asString(row.created_at),
  }
}

async function loadProviderNames(admin: SupabaseClient, providerIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  if (providerIds.length === 0) return names

  const { data, error } = await admin
    .schema("growth")
    .from("delivery_providers")
    .select("id, provider_name")
    .in("id", providerIds)

  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    const record = row as Record<string, unknown>
    names.set(asString(record.id), asString(record.provider_name) || "Provider")
  }

  return names
}

export async function createDeliveryEvent(
  admin: SupabaseClient,
  input: {
    provider_id: string
    event_type: string
    severity: GrowthDeliveryEventSeverity
    title: string
    description: string
    metadata?: Record<string, unknown>
  },
): Promise<GrowthDeliveryEvent> {
  const { data, error } = await eventsTable(admin)
    .insert({
      provider_id: input.provider_id,
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

export async function listDeliveryEvents(
  admin: SupabaseClient,
  input?: { limit?: number; provider_id?: string },
): Promise<GrowthDeliveryEvent[]> {
  let query = eventsTable(admin).select("*").order("created_at", { ascending: false }).limit(input?.limit ?? 50)
  if (input?.provider_id) query = query.eq("provider_id", input.provider_id)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const providerIds = [...new Set((data ?? []).map((row) => asString((row as Record<string, unknown>).provider_id)).filter(Boolean))]
  const providerNames = await loadProviderNames(admin, providerIds)

  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>
    return mapEvent(record, providerNames.get(asString(record.provider_id)) ?? "")
  })
}

export async function providerHasCriticalDeliveryEvent(admin: SupabaseClient, providerId: string): Promise<boolean> {
  const { count, error } = await eventsTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("provider_id", providerId)
    .eq("severity", "critical")
    .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

  if (error) throw new Error(error.message)
  return (count ?? 0) > 0
}

export async function appendDeliveryTimelineEvent(
  admin: SupabaseClient,
  input: {
    eventType: GrowthDeliveryTimelineEventType
    title: string
    summary?: string | null
    providerId?: string | null
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
      provider_id: input.providerId ?? null,
    },
    actor_user_id: input.actorUserId ?? null,
    actor_email: input.actorEmail ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function persistDeliveryEventDrafts(
  admin: SupabaseClient,
  providerId: string,
  drafts: DeliveryEventDraft[],
  actor?: { actorUserId?: string | null; actorEmail?: string | null },
): Promise<void> {
  for (const draft of drafts) {
    await createDeliveryEvent(admin, {
      provider_id: providerId,
      event_type: draft.event_type,
      severity: draft.severity,
      title: draft.title,
      description: draft.description,
      metadata: draft.metadata,
    })
    if (draft.timeline_type) {
      await appendDeliveryTimelineEvent(admin, {
        eventType: draft.timeline_type,
        title: draft.title,
        summary: draft.description,
        providerId,
        payload: draft.metadata,
        actorUserId: actor?.actorUserId,
        actorEmail: actor?.actorEmail,
      })
    }
  }
}
