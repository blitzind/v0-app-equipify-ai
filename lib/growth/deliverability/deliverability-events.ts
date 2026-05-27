/** Deliverability event feed + timeline helpers. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthDeliverabilityEvent,
  GrowthDeliverabilityEventSeverity,
  GrowthDeliverabilityTimelineEventType,
} from "@/lib/growth/deliverability/deliverability-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("deliverability_events")
}

function timelineTable(admin: SupabaseClient) {
  return admin.schema("growth").from("platform_timeline_events")
}

function mapEvent(row: Record<string, unknown>, domain = ""): GrowthDeliverabilityEvent {
  return {
    id: asString(row.id),
    domain_id: asString(row.domain_id),
    domain,
    severity: asString(row.severity) as GrowthDeliverabilityEventSeverity,
    event_type: asString(row.event_type) || "health_check",
    title: asString(row.title),
    description: asString(row.description),
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {},
    resolved: Boolean(row.resolved),
    resolved_at: asString(row.resolved_at) || null,
    created_at: asString(row.created_at),
  }
}

export async function createDeliverabilityEvent(
  admin: SupabaseClient,
  input: {
    domain_id: string
    event_type: string
    severity: GrowthDeliverabilityEventSeverity
    title: string
    description: string
    metadata?: Record<string, unknown>
  },
): Promise<GrowthDeliverabilityEvent> {
  const { data, error } = await eventsTable(admin)
    .insert({
      domain_id: input.domain_id,
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

export async function listDeliverabilityEvents(
  admin: SupabaseClient,
  input?: { limit?: number; domain_id?: string; unresolved_only?: boolean },
): Promise<GrowthDeliverabilityEvent[]> {
  let query = eventsTable(admin).select("*").order("created_at", { ascending: false }).limit(input?.limit ?? 50)
  if (input?.domain_id) query = query.eq("domain_id", input.domain_id)
  if (input?.unresolved_only) query = query.eq("resolved", false)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const domainIds = [...new Set((data ?? []).map((row) => asString((row as Record<string, unknown>).domain_id)).filter(Boolean))]
  const domainMap = new Map<string, string>()
  if (domainIds.length > 0) {
    const { data: domains } = await admin.schema("growth").from("sender_domains").select("id, domain").in("id", domainIds)
    for (const row of domains ?? []) {
      const r = row as Record<string, unknown>
      domainMap.set(asString(r.id), asString(r.domain))
    }
  }

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    return mapEvent(r, domainMap.get(asString(r.domain_id)) ?? "")
  })
}

export async function resolveDeliverabilityEvent(
  admin: SupabaseClient,
  eventId: string,
): Promise<GrowthDeliverabilityEvent> {
  const resolvedAt = new Date().toISOString()
  const { data, error } = await eventsTable(admin)
    .update({ resolved: true, resolved_at: resolvedAt })
    .eq("id", eventId)
    .select("*")
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("deliverability_event_not_found")

  const row = data as Record<string, unknown>
  const { data: domainRow } = await admin
    .schema("growth")
    .from("sender_domains")
    .select("domain")
    .eq("id", asString(row.domain_id))
    .maybeSingle()

  return mapEvent(row, asString((domainRow as Record<string, unknown> | null)?.domain))
}

export async function appendDeliverabilityTimelineEvent(
  admin: SupabaseClient,
  input: {
    eventType: GrowthDeliverabilityTimelineEventType
    title: string
    summary?: string | null
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
      domain_id: input.domainId ?? null,
    },
    actor_user_id: input.actorUserId ?? null,
    actor_email: input.actorEmail ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function listDeliverabilityTimelineEvents(
  admin: SupabaseClient,
  input?: { limit?: number },
): Promise<
  Array<{
    id: string
    event_type: GrowthDeliverabilityTimelineEventType
    title: string
    summary: string | null
    payload: Record<string, unknown>
    occurred_at: string
  }>
> {
  const { data, error } = await timelineTable(admin)
    .select("id, event_type, title, summary, payload, occurred_at")
    .in("event_type", [
      "spf_missing",
      "dkim_missing",
      "dmarc_missing",
      "dns_health_declined",
      "deliverability_improved",
      "domain_warning_created",
    ])
    .order("occurred_at", { ascending: false })
    .limit(input?.limit ?? 30)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    return {
      id: asString(r.id),
      event_type: asString(r.event_type) as GrowthDeliverabilityTimelineEventType,
      title: asString(r.title),
      summary: asString(r.summary) || null,
      payload: r.payload && typeof r.payload === "object" ? (r.payload as Record<string, unknown>) : {},
      occurred_at: asString(r.occurred_at),
    }
  })
}
