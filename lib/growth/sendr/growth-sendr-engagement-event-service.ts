import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_SENDR_LIMITS,
  GROWTH_SENDR_QA_MARKER,
} from "@/lib/growth/sendr/growth-sendr-config"
import {
  assertSendrOrgAssetCap,
  consumeSendrBudget,
  recordSendrGuardrailFailure,
} from "@/lib/growth/sendr/growth-sendr-guardrails"
import type { GrowthSendrEngagementEventInput } from "@/lib/growth/sendr/growth-sendr-types"
import {
  recordRuntimeHealthRead,
  recordRuntimeHealthWrite,
} from "@/lib/growth/runtime-guardrails/growth-runtime-health-counter-service"
import type { GrowthRuntimeResourceType } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_engagement_events")
}

function rollupsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_engagement_event_rollups")
}

function sessionCapForEvent(eventType: GrowthSendrEngagementEventInput["eventType"]): number {
  if (eventType.startsWith("video_")) return GROWTH_SENDR_LIMITS.MAX_VIDEO_EVENTS_PER_SESSION
  if (eventType.startsWith("agent_")) return GROWTH_SENDR_LIMITS.MAX_AGENT_EVENTS_PER_SESSION
  if (eventType === "page_view" || eventType === "scroll" || eventType === "cta_click") {
    return GROWTH_SENDR_LIMITS.MAX_PAGE_VIEWS_PER_SESSION
  }
  return GROWTH_SENDR_LIMITS.MAX_MEDIA_EVENT_BATCH
}

async function countSessionEvents(
  admin: SupabaseClient,
  input: { organizationId: string; sessionId: string; eventType: string },
): Promise<number> {
  const { count, error } = await eventsTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", input.organizationId)
    .eq("session_id", input.sessionId)
    .eq("event_type", input.eventType)
  if (error) return 0
  return count ?? 0
}

async function incrementEngagementRollup(
  admin: SupabaseClient,
  input: { organizationId: string; eventType: string },
): Promise<void> {
  const rollupDate = new Date().toISOString().slice(0, 10)
  const { data } = await rollupsTable(admin)
    .select("event_count")
    .eq("organization_id", input.organizationId)
    .eq("rollup_date", rollupDate)
    .eq("event_type", input.eventType)
    .maybeSingle()

  const nextCount = Number((data as { event_count?: number } | null)?.event_count ?? 0) + 1
  const { error } = await rollupsTable(admin).upsert(
    {
      organization_id: input.organizationId,
      rollup_date: rollupDate,
      event_type: input.eventType,
      event_count: nextCount,
      last_event_at: new Date().toISOString(),
      qa_marker: GROWTH_SENDR_QA_MARKER,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,rollup_date,event_type" },
  )
  if (error) throw new Error(error.message)
}

function defaultResourceTypeForEvent(
  eventType: GrowthSendrEngagementEventInput["eventType"],
): GrowthRuntimeResourceType {
  if (eventType.startsWith("video_")) return "video_events"
  if (eventType.startsWith("booking_") || eventType === "calendar_open") return "bookings"
  return "page_views"
}

/** Append-only engagement events with session caps and incremental rollups. */
export async function appendGrowthSendrEngagementEvents(
  admin: SupabaseClient,
  input: {
    organizationId: string
    events: GrowthSendrEngagementEventInput[]
    resourceTypeResolver?: (eventType: GrowthSendrEngagementEventInput["eventType"]) => GrowthRuntimeResourceType
  },
): Promise<{ accepted: number; throttled: number; rowsWritten: number }> {
  const batch = input.events.slice(0, GROWTH_SENDR_LIMITS.MAX_MEDIA_EVENT_BATCH)
  if (batch.length === 0) return { accepted: 0, throttled: 0, rowsWritten: 0 }

  const resolveResource = input.resourceTypeResolver ?? defaultResourceTypeForEvent

  // Budget check per resource type bucket
  const volumeByResource = new Map<GrowthRuntimeResourceType, number>()
  for (const event of batch) {
    const rt = resolveResource(event.eventType)
    volumeByResource.set(rt, (volumeByResource.get(rt) ?? 0) + 1)
  }
  for (const [resourceType, volume] of volumeByResource) {
    const budget = await consumeSendrBudget(admin, {
      organizationId: input.organizationId,
      resourceType,
      volume,
    })
    if (!budget.allowed) {
      await recordSendrGuardrailFailure(admin, budget.reason ?? "engagement_budget_exceeded")
      return { accepted: 0, throttled: batch.length, rowsWritten: 0 }
    }
  }

  let accepted = 0
  let throttled = 0
  const rows: Record<string, unknown>[] = []

  for (const event of batch) {
    const cap = sessionCapForEvent(event.eventType)
    const existing = await countSessionEvents(admin, {
      organizationId: input.organizationId,
      sessionId: event.sessionId,
      eventType: event.eventType,
    })
    if (existing >= cap) {
      throttled += 1
      continue
    }
    rows.push({
      organization_id: input.organizationId,
      session_id: event.sessionId,
      landing_page_id: event.landingPageId ?? null,
      video_asset_id: event.videoAssetId ?? null,
      booking_asset_id: event.bookingAssetId ?? null,
      conversation_agent_id: event.conversationAgentId ?? null,
      event_type: event.eventType,
      event_value: event.eventValue ?? {},
      qa_marker: GROWTH_SENDR_QA_MARKER,
    })
    accepted += 1
  }

  if (rows.length === 0) {
    return { accepted: 0, throttled, rowsWritten: 0 }
  }

  await recordRuntimeHealthRead(admin, rows.length)
  const { error } = await eventsTable(admin).insert(rows)
  if (error) {
    await recordSendrGuardrailFailure(admin, error.message)
    throw new Error(error.message)
  }

  for (const row of rows) {
    await incrementEngagementRollup(admin, {
      organizationId: input.organizationId,
      eventType: String(row.event_type),
    })
  }

  await recordRuntimeHealthWrite(admin, rows.length)
  return { accepted, throttled, rowsWritten: rows.length }
}

export async function countGrowthSendrEngagementEventsToday(
  admin: SupabaseClient,
  organizationId: string,
  dayStart: string,
): Promise<number> {
  const { count, error } = await eventsTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", dayStart)
  if (error) return 0
  return count ?? 0
}

export async function countGrowthSendrEngagementEventsByTypeToday(
  admin: SupabaseClient,
  organizationId: string,
  dayStart: string,
  eventType: string,
): Promise<number> {
  const { count, error } = await eventsTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("event_type", eventType)
    .gte("created_at", dayStart)
  if (error) return 0
  return count ?? 0
}
