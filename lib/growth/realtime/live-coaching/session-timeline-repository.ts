import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildDeterministicSessionTimelineEventId } from "@/lib/growth/realtime/live-coaching/session-timeline-event-id"
import {
  assertSessionTimelineDetailSafe,
  sanitizeSessionTimelineDetail,
} from "@/lib/growth/realtime/live-coaching/session-timeline-detail-safety"
import type {
  LiveCoachingSessionTimelineEvent,
  LiveCoachingSessionTimelineEventType,
  LiveCoachingSessionTimelineSeverity,
} from "@/lib/growth/realtime/live-coaching/session-timeline-types"

const TIMELINE_SELECT =
  "id, lead_id, session_id, sequence_number, event_type, severity, provider_id, detail, created_at"

const MAX_EVENTS_PER_SESSION = 500

type TimelineDbRow = {
  id: string
  lead_id: string
  session_id: string
  sequence_number: number
  event_type: string
  severity: string
  provider_id: string | null
  detail: Record<string, unknown>
  created_at: string
}

function timelineTable(admin: SupabaseClient) {
  return admin.schema("growth").from("realtime_call_session_timeline_events")
}

function mapTimelineRow(row: TimelineDbRow): LiveCoachingSessionTimelineEvent {
  return {
    id: row.id,
    leadId: row.lead_id,
    sessionId: row.session_id,
    sequenceNumber: row.sequence_number,
    eventType: row.event_type as LiveCoachingSessionTimelineEventType,
    severity: row.severity as LiveCoachingSessionTimelineSeverity,
    providerId: row.provider_id,
    detail: sanitizeSessionTimelineDetail(row.detail ?? {}),
    createdAt: row.created_at,
  }
}

async function nextSessionTimelineSequenceNumber(
  admin: SupabaseClient,
  sessionId: string,
): Promise<number> {
  const { data, error } = await timelineTable(admin)
    .select("sequence_number")
    .eq("session_id", sessionId)
    .order("sequence_number", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? (data.sequence_number as number) + 1 : 0
}

export async function appendLiveCoachingSessionTimelineEvent(
  admin: SupabaseClient,
  input: {
    leadId: string
    sessionId: string
    eventType: LiveCoachingSessionTimelineEventType
    severity: LiveCoachingSessionTimelineSeverity
    providerId?: string | null
    detail?: Record<string, unknown>
    dedupeKey?: string | null
  },
): Promise<LiveCoachingSessionTimelineEvent | null> {
  if (input.dedupeKey) {
    const { data: existing, error: existingError } = await timelineTable(admin)
      .select(TIMELINE_SELECT)
      .eq("session_id", input.sessionId)
      .eq("dedupe_key", input.dedupeKey)
      .maybeSingle()
    if (existingError) throw new Error(existingError.message)
    if (existing) return mapTimelineRow(existing as TimelineDbRow)
  }

  const detail = sanitizeSessionTimelineDetail(input.detail ?? {})
  assertSessionTimelineDetailSafe(detail)

  const sequenceNumber = await nextSessionTimelineSequenceNumber(admin, input.sessionId)
  const id = buildDeterministicSessionTimelineEventId({
    sessionId: input.sessionId,
    sequenceNumber,
    eventType: input.eventType,
  })

  const { data, error } = await timelineTable(admin)
    .insert({
      id,
      lead_id: input.leadId,
      session_id: input.sessionId,
      sequence_number: sequenceNumber,
      event_type: input.eventType,
      severity: input.severity,
      provider_id: input.providerId ?? null,
      detail,
      dedupe_key: input.dedupeKey ?? null,
    })
    .select(TIMELINE_SELECT)
    .single()

  if (error) {
    if (input.dedupeKey && error.code === "23505") {
      const { data: existing, error: existingError } = await timelineTable(admin)
        .select(TIMELINE_SELECT)
        .eq("session_id", input.sessionId)
        .eq("dedupe_key", input.dedupeKey)
        .maybeSingle()
      if (existingError) throw new Error(existingError.message)
      if (existing) return mapTimelineRow(existing as TimelineDbRow)
    }
    throw new Error(error.message)
  }

  return mapTimelineRow(data as TimelineDbRow)
}

export async function listLiveCoachingSessionTimelineEvents(
  admin: SupabaseClient,
  input: { sessionId: string; leadId: string; limit?: number },
): Promise<LiveCoachingSessionTimelineEvent[]> {
  const limit = Math.min(input.limit ?? MAX_EVENTS_PER_SESSION, MAX_EVENTS_PER_SESSION)
  const { data, error } = await timelineTable(admin)
    .select(TIMELINE_SELECT)
    .eq("session_id", input.sessionId)
    .eq("lead_id", input.leadId)
    .order("sequence_number", { ascending: true })
    .limit(limit)

  if (error) throw new Error(error.message)
  return ((data ?? []) as TimelineDbRow[]).map(mapTimelineRow)
}

export async function countLiveCoachingSessionTimelineEvents(
  admin: SupabaseClient,
  sessionId: string,
): Promise<number> {
  const { count, error } = await timelineTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
  if (error) throw new Error(error.message)
  return count ?? 0
}

export const LIVE_COACHING_SESSION_TIMELINE_MAX_EVENTS = MAX_EVENTS_PER_SESSION
