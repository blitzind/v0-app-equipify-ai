import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import type { GrowthLeadTimelineEvent, GrowthLeadTimelineEventType } from "@/lib/growth/timeline-types"

const TIMELINE_SELECT =
  "id, lead_id, event_type, title, summary, actor_user_id, actor_email, research_run_id, call_event_id, decision_maker_id, outbound_message_id, message_event_id, outbound_reply_id, payload, occurred_at, created_at"

type TimelineDbRow = {
  id: string
  lead_id: string
  event_type: string
  title: string
  summary: string | null
  actor_user_id: string | null
  actor_email: string | null
  research_run_id: string | null
  call_event_id: string | null
  decision_maker_id: string | null
  outbound_message_id: string | null
  message_event_id: string | null
  outbound_reply_id: string | null
  payload: Record<string, unknown> | null
  occurred_at: string
  created_at: string
}

function timelineTable(admin: SupabaseClient) {
  return admin.schema("growth").from("lead_timeline_events")
}

function mapTimelineRow(row: TimelineDbRow): GrowthLeadTimelineEvent {
  return {
    id: row.id,
    leadId: row.lead_id,
    eventType: row.event_type as GrowthLeadTimelineEventType,
    title: row.title,
    summary: row.summary,
    actorUserId: row.actor_user_id,
    actorEmail: row.actor_email,
    researchRunId: row.research_run_id,
    callEventId: row.call_event_id,
    decisionMakerId: row.decision_maker_id,
    outboundMessageId: row.outbound_message_id,
    messageEventId: row.message_event_id,
    outboundReplyId: row.outbound_reply_id,
    payload: row.payload ?? {},
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  }
}

export async function appendGrowthLeadTimelineEvent(
  admin: SupabaseClient,
  input: {
    leadId: string
    eventType: GrowthLeadTimelineEventType
    title: string
    summary?: string | null
    payload?: Record<string, unknown>
    actorUserId?: string | null
    actorEmail?: string | null
    occurredAt?: string
    researchRunId?: string | null
    callEventId?: string | null
    decisionMakerId?: string | null
    outboundMessageId?: string | null
    messageEventId?: string | null
    outboundReplyId?: string | null
  },
): Promise<GrowthLeadTimelineEvent> {
  const { data, error } = await timelineTable(admin)
    .insert({
      lead_id: input.leadId,
      event_type: input.eventType,
      title: input.title,
      summary: input.summary?.trim() ? input.summary.trim() : null,
      payload: input.payload ?? {},
      actor_user_id: input.actorUserId ?? null,
      actor_email: input.actorEmail?.trim() ? input.actorEmail.trim() : null,
      research_run_id: input.researchRunId ?? null,
      call_event_id: input.callEventId ?? null,
      decision_maker_id: input.decisionMakerId ?? null,
      outbound_message_id: input.outboundMessageId ?? null,
      message_event_id: input.messageEventId ?? null,
      outbound_reply_id: input.outboundReplyId ?? null,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
    })
    .select(TIMELINE_SELECT)
    .single()

  if (error) {
    logGrowthEngine("timeline_event_insert_failed", {
      leadId: input.leadId,
      eventType: input.eventType,
      message: error.message,
    })
    throw new Error(error.message)
  }

  return mapTimelineRow(data as TimelineDbRow)
}

export async function listGrowthLeadTimelineEvents(
  admin: SupabaseClient,
  input: {
    leadId: string
    limit?: number
    offset?: number
  },
): Promise<GrowthLeadTimelineEvent[]> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100)
  const offset = Math.max(input.offset ?? 0, 0)

  const { data, error } = await timelineTable(admin)
    .select(TIMELINE_SELECT)
    .eq("lead_id", input.leadId)
    .order("occurred_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)
  return ((data ?? []) as TimelineDbRow[]).map(mapTimelineRow)
}

export async function countGrowthLeadTimelineEventsByType(
  admin: SupabaseClient,
  leadId: string,
  eventType: GrowthLeadTimelineEventType,
  sinceIso: string,
): Promise<number> {
  const { count, error } = await timelineTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .eq("event_type", eventType)
    .gte("occurred_at", sinceIso)

  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function hasGrowthLeadTimelineEventTypeSince(
  admin: SupabaseClient,
  leadId: string,
  eventType: GrowthLeadTimelineEventType,
  sinceIso?: string,
): Promise<boolean> {
  let query = timelineTable(admin)
    .select("id")
    .eq("lead_id", leadId)
    .eq("event_type", eventType)
    .limit(1)

  if (sinceIso) query = query.gte("occurred_at", sinceIso)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data?.length ?? 0) > 0
}
