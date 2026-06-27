/** Phase GS-4C — Realtime Event Bus server service — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { normalizeGrowthRealtimeEvent, type RawSignalEventRow } from "@/lib/growth/realtime-events/realtime-events-normalizer"
import {
  filterGrowthRealtimeEvents,
  rankGrowthRealtimeEvents,
} from "@/lib/growth/realtime-events/realtime-events-priority"
import { buildEnvelope, routeGrowthRealtimeEvent } from "@/lib/growth/realtime-events/realtime-events-router"
import {
  REALTIME_EVENTS_QA_MARKER,
  type GrowthRealtimeEvent,
  type GrowthRealtimeEventSource,
  type GrowthRealtimeEventsResponse,
  type RealtimeEventAuditEvent,
  type RealtimeEventFilter,
} from "@/lib/growth/realtime-events/realtime-events-types"
import { isGrowthSignalFoundationSchemaReady } from "@/lib/growth/signals/signal-schema-health"

async function persistRealtimeEventAudit(
  admin: SupabaseClient,
  input: {
    event_name: RealtimeEventAuditEvent
    event: GrowthRealtimeEvent
    organization_id: string
    operator_id?: string | null
  },
): Promise<{ ok: boolean; audit_event_id?: string; error?: string }> {
  if (!(await isGrowthSignalFoundationSchemaReady(admin))) {
    return { ok: false, error: "schema_not_ready" }
  }

  const now = new Date().toISOString()
  const { data, error } = await admin
    .schema("growth")
    .from("signal_events")
    .insert({
      signal_id: null,
      organization_id: input.organization_id,
      event_type: "scored",
      event_payload: {
        qa_marker: REALTIME_EVENTS_QA_MARKER,
        event_name: input.event_name,
        realtime_event: true,
        event_id: input.event.event_id,
        delivery_status: input.event.delivery_status,
        routes: input.event.routes,
        event: input.event,
        operator_id: input.operator_id ?? null,
        occurred_at: now,
        requires_human_review: true,
        requires_human_approval: true,
        enrollment_enabled: false,
        outreach_enabled: false,
        outreach_execution: false,
        enrollment_execution: false,
        autonomous_execution_enabled: false,
      },
      occurred_at: now,
    })
    .select("id")
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  return { ok: true, audit_event_id: data?.id as string | undefined }
}

export async function publishGrowthRealtimeEvent(
  admin: SupabaseClient,
  input: {
    event_type: string
    source?: GrowthRealtimeEventSource
    payload?: Record<string, unknown>
    lead_id?: string | null
    organization_id?: string | null
    operator_id?: string | null
  },
): Promise<{ ok: boolean; event?: GrowthRealtimeEvent; error?: string }> {
  const organization_id = input.organization_id ?? getGrowthEngineAiOrgId()
  if (!organization_id) return { ok: false, error: "organization_id_required" }
  if (!(await isGrowthSignalFoundationSchemaReady(admin))) {
    return { ok: false, error: "schema_not_ready" }
  }

  const event_id = randomUUID()
  const now = new Date().toISOString()
  const source = input.source ?? "realtime_event_bus"
  const routes = routeGrowthRealtimeEvent({
    event_type: input.event_type,
    source,
    qa_marker: REALTIME_EVENTS_QA_MARKER,
    lead_id: input.lead_id ?? null,
  })

  const envelopePayload = {
    ...(input.payload ?? {}),
    qa_marker: REALTIME_EVENTS_QA_MARKER,
    event_name: "realtime_event_published",
    source,
    lead_id: input.lead_id ?? null,
    routes,
    delivery_status: "routed" as const,
    realtime_event: true,
  }

  const envelope = buildEnvelope({
    event_id,
    event_type: input.event_type,
    source,
    organization_id,
    payload: envelopePayload,
    created_at: now,
  })

  const { data, error } = await admin
    .schema("growth")
    .from("signal_events")
    .insert({
      signal_id: null,
      organization_id,
      event_type: "scored",
      event_payload: {
        ...envelope.payload,
        logical_event_type: input.event_type,
        envelope,
        requires_human_review: true,
        autonomous_execution_enabled: false,
        outreach_execution: false,
        enrollment_execution: false,
      },
      occurred_at: now,
    })
    .select("id, organization_id, event_type, event_payload, occurred_at")
    .maybeSingle()

  if (error) return { ok: false, error: error.message }

  const normalized = normalizeGrowthRealtimeEvent(data as RawSignalEventRow)

  await persistRealtimeEventAudit(admin, {
    event_name: "realtime_event_routed",
    event: normalized,
    organization_id,
    operator_id: input.operator_id,
  })

  try {
    const signalRowId = (data as { id?: string } | null)?.id
    if (signalRowId) {
      const { bridgeRealtimeEnvelopeToEventBus } = await import(
        "@/lib/growth/aios/event-bus/growth-ai-event-bus-service"
      )
      await bridgeRealtimeEnvelopeToEventBus(admin, {
        organizationId: organization_id,
        legacyEventId: signalRowId,
        logicalEventType: `realtime.${input.event_type}`,
        leadId: input.lead_id ?? null,
        payload: envelopePayload,
      })
    }
  } catch {
    // Bridge failure must not block realtime UI bus.
  }

  return { ok: true, event: normalized }
}

export async function fetchGrowthRealtimeEvents(
  admin: SupabaseClient,
  input?: {
    filter?: RealtimeEventFilter
    limit?: number
    organization_id?: string | null
  },
): Promise<GrowthRealtimeEventsResponse> {
  const organization_id = input?.organization_id ?? getGrowthEngineAiOrgId()
  const limit = Math.min(Math.max(input?.limit ?? 30, 1), 100)

  if (!(await isGrowthSignalFoundationSchemaReady(admin))) {
    return {
      qa_marker: REALTIME_EVENTS_QA_MARKER,
      generated_at: new Date().toISOString(),
      total: 0,
      routed_count: 0,
      pending_count: 0,
      subscription_mode: "unavailable",
      events: [],
      requires_human_review: true,
      autonomous_execution_enabled: false,
    }
  }

  let query = admin
    .schema("growth")
    .from("signal_events")
    .select("id, organization_id, event_type, event_payload, occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(limit * 3)

  if (organization_id) {
    query = query.eq("organization_id", organization_id)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const normalized = (data ?? []).map((row) =>
    normalizeGrowthRealtimeEvent(row as RawSignalEventRow),
  )
  const filtered = filterGrowthRealtimeEvents(normalized, input?.filter ?? "all")
  const ranked = rankGrowthRealtimeEvents(filtered).slice(0, limit)

  return {
    qa_marker: REALTIME_EVENTS_QA_MARKER,
    generated_at: new Date().toISOString(),
    total: ranked.length,
    routed_count: ranked.filter((e) => e.delivery_status === "routed" || e.delivery_status === "delivered").length,
    pending_count: ranked.filter((e) => e.delivery_status === "pending").length,
    subscription_mode: "polling",
    events: ranked,
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }
}

export async function applyGrowthRealtimeEventAction(
  admin: SupabaseClient,
  input: {
    action: "mark_reviewed" | "dismiss" | "view_details"
    event: GrowthRealtimeEvent
    operator_id?: string | null
  },
): Promise<{ ok: boolean; error?: string }> {
  const organization_id = getGrowthEngineAiOrgId()
  if (!organization_id) return { ok: false, error: "organization_id_required" }

  const eventName: RealtimeEventAuditEvent =
    input.action === "dismiss"
      ? "realtime_event_dismissed"
      : input.action === "mark_reviewed"
        ? "realtime_event_reviewed"
        : "realtime_event_published"

  const updated: GrowthRealtimeEvent = {
    ...input.event,
    review_status:
      input.action === "dismiss"
        ? "dismissed"
        : input.action === "mark_reviewed"
          ? "reviewed"
          : input.event.review_status,
    delivery_status:
      input.action === "mark_reviewed"
        ? "reviewed"
        : input.action === "dismiss"
          ? "dismissed"
          : input.event.delivery_status,
  }

  await persistRealtimeEventAudit(admin, {
    event_name: eventName,
    event: updated,
    organization_id,
    operator_id: input.operator_id,
  })

  return { ok: true }
}
