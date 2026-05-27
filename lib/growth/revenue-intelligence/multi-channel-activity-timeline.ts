import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER,
  type GrowthMultichannelActivityEntry,
  type GrowthMultichannelChannel,
} from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase7-types"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"

type TimelineInsert = {
  leadId: string
  channel: GrowthMultichannelChannel
  eventKind: string
  eventSource: string
  title: string
  summary: string
  evidenceExcerpt?: string | null
  occurredAt: string
  attributionType?: string | null
  outboundReplyId?: string | null
  meetingId?: string | null
  callSessionId?: string | null
  cadenceTaskId?: string | null
  channelTaskId?: string | null
  intentSessionId?: string | null
  payload?: Record<string, unknown>
}

function mapRow(row: Record<string, unknown>): GrowthMultichannelActivityEntry {
  return {
    id: String(row.id),
    channel: String(row.channel) as GrowthMultichannelChannel,
    eventKind: String(row.event_kind),
    eventSource: String(row.event_source),
    title: String(row.title),
    summary: String(row.summary),
    evidenceExcerpt: row.evidence_excerpt ? String(row.evidence_excerpt) : null,
    occurredAt: String(row.occurred_at),
    attributionType: row.attribution_type ? String(row.attribution_type) : null,
    payload: (row.payload as Record<string, unknown>) ?? {},
  }
}

export async function persistMultiChannelTimelineEvent(
  admin: SupabaseClient,
  input: TimelineInsert,
): Promise<string | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("multi_channel_activity_timeline_events")
    .insert({
      lead_id: input.leadId,
      channel: input.channel,
      event_kind: input.eventKind,
      event_source: input.eventSource,
      title: input.title,
      summary: input.summary,
      evidence_excerpt: input.evidenceExcerpt?.slice(0, 500) ?? null,
      occurred_at: input.occurredAt,
      attribution_type: input.attributionType ?? null,
      outbound_reply_id: input.outboundReplyId ?? null,
      meeting_id: input.meetingId ?? null,
      call_session_id: input.callSessionId ?? null,
      cadence_task_id: input.cadenceTaskId ?? null,
      channel_task_id: input.channelTaskId ?? null,
      intent_session_id: input.intentSessionId ?? null,
      payload: input.payload ?? {},
      qa_marker: GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER,
    })
    .select("id")
    .single()

  if (error) return null
  return String((data as { id: string }).id)
}

async function loadLiveTimelineCandidates(admin: SupabaseClient, leadId: string): Promise<TimelineInsert[]> {
  const candidates: TimelineInsert[] = []
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const [repliesRes, callsRes, meetingsRes, cadenceRes, intentRes, leadTimelineRes] = await Promise.all([
    admin
      .schema("growth")
      .from("outbound_replies")
      .select("id, body_preview, received_at, intent")
      .eq("lead_id", leadId)
      .gte("received_at", since)
      .order("received_at", { ascending: false })
      .limit(30),
    admin
      .schema("growth")
      .from("lead_call_events")
      .select("id, disposition, note, created_at")
      .eq("lead_id", leadId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(30),
    admin
      .schema("growth")
      .from("meetings")
      .select("id, title, status, outcome, start_at, completed_at, no_show_at, scheduled_at, notes, created_at")
      .eq("lead_id", leadId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(30)
      .then((r) => r)
      .catch(() => ({ data: [] as unknown[], error: null })),
    admin
      .schema("growth")
      .from("cadence_tasks")
      .select("id, channel, status, completed_at, due_at, created_at")
      .eq("lead_id", leadId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(30)
      .then((r) => r)
      .catch(() => ({ data: [] as unknown[], error: null })),
    admin
      .schema("growth")
      .from("intent_visitor_sessions")
      .select("id, pageview_count, last_seen_at, identified_at")
      .eq("lead_id", leadId)
      .gte("last_seen_at", since)
      .order("last_seen_at", { ascending: false })
      .limit(20)
      .then((r) => r)
      .catch(() => ({ data: [] as unknown[], error: null })),
    admin
      .schema("growth")
      .from("lead_timeline_events")
      .select("event_type, title, summary, created_at, payload")
      .eq("lead_id", leadId)
      .in("event_type", ["email_sent", "email_opened", "email_clicked", "notes_updated", "manual_touch"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(40),
  ])

  for (const row of repliesRes.data ?? []) {
    const record = row as Record<string, unknown>
    candidates.push({
      leadId,
      channel: "email",
      eventKind: "reply_received",
      eventSource: "outbound_replies",
      title: "Inbound reply",
      summary: `Reply classified as ${String(record.intent ?? "unknown")}.`,
      evidenceExcerpt: record.body_preview ? String(record.body_preview) : null,
      occurredAt: String(record.received_at),
      attributionType: "reply",
      outboundReplyId: String(record.id),
    })
  }

  for (const row of callsRes.data ?? []) {
    const record = row as Record<string, unknown>
    candidates.push({
      leadId,
      channel: "call",
      eventKind: "call_outcome",
      eventSource: "lead_call_events",
      title: "Call logged",
      summary: `Disposition: ${String(record.disposition)}.`,
      evidenceExcerpt: record.note ? String(record.note) : null,
      occurredAt: String(record.created_at),
      attributionType: "call",
      payload: { disposition: record.disposition },
    })
  }

  for (const row of meetingsRes.data ?? []) {
    const record = row as Record<string, unknown>
    const status = String(record.status ?? "scheduled")
    const occurredAt = String(
      record.completed_at ?? record.no_show_at ?? record.scheduled_at ?? record.start_at ?? record.created_at ?? new Date().toISOString(),
    )
    candidates.push({
      leadId,
      channel: "meeting",
      eventKind: status === "no_show" ? "meeting_no_show" : status === "completed" ? "meeting_attended" : "meeting_booked",
      eventSource: "meetings",
      title: String(record.title ?? "Meeting"),
      summary: `Meeting ${status}${record.outcome ? `: ${String(record.outcome)}` : ""}.`,
      evidenceExcerpt: record.notes ? String(record.notes) : null,
      occurredAt,
      attributionType: "meeting",
      meetingId: String(record.id),
      payload: { status, outcome: record.outcome },
    })
  }

  for (const row of cadenceRes.data ?? []) {
    const record = row as Record<string, unknown>
    const channel = String(record.channel ?? "cadence")
    const mappedChannel: GrowthMultichannelChannel =
      channel === "sms" ? "sms" : channel === "linkedin" ? "linkedin" : channel === "call" ? "call" : "cadence"
    candidates.push({
      leadId,
      channel: mappedChannel,
      eventKind: String(record.status ?? "cadence_task"),
      eventSource: "cadence_tasks",
      title: `Cadence ${String(record.status)}`,
      summary: `${mappedChannel} cadence task ${String(record.status)}.`,
      occurredAt: String(record.completed_at ?? record.due_at ?? record.created_at),
      attributionType: "cadence",
      cadenceTaskId: String(record.id),
      payload: { channel: mappedChannel, status: record.status },
    })
  }

  for (const row of intentRes.data ?? []) {
    const record = row as Record<string, unknown>
    candidates.push({
      leadId,
      channel: "website",
      eventKind: "website_visit",
      eventSource: "intent_visitor_sessions",
      title: "Website engagement",
      summary: `${Number(record.pageview_count ?? 0)} pageview(s) in session.`,
      occurredAt: String(record.last_seen_at ?? new Date().toISOString()),
      attributionType: "website_intent",
      intentSessionId: String(record.id),
      payload: { pageview_count: record.pageview_count, identified: Boolean(record.identified_at) },
    })
  }

  for (const row of leadTimelineRes.data ?? []) {
    const record = row as Record<string, unknown>
    const eventType = String(record.event_type)
    const channel: GrowthMultichannelChannel =
      eventType.startsWith("email_") ? "email" : eventType === "notes_updated" ? "note" : "other"
    candidates.push({
      leadId,
      channel,
      eventKind: eventType,
      eventSource: "lead_timeline_events",
      title: String(record.title),
      summary: String(record.summary),
      occurredAt: String(record.created_at),
      attributionType: "lead_timeline",
      payload: (record.payload as Record<string, unknown>) ?? {},
    })
  }

  return candidates.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
}

export async function syncMultiChannelTimelineForLead(admin: SupabaseClient, leadId: string): Promise<number> {
  const candidates = await loadLiveTimelineCandidates(admin, leadId)
  let inserted = 0

  for (const candidate of candidates.slice(0, 50)) {
    const { count } = await admin
      .schema("growth")
      .from("multi_channel_activity_timeline_events")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", leadId)
      .eq("event_source", candidate.eventSource)
      .eq("event_kind", candidate.eventKind)
      .eq("occurred_at", candidate.occurredAt)

    if ((count ?? 0) > 0) continue

    const id = await persistMultiChannelTimelineEvent(admin, candidate)
    if (id) inserted += 1
  }

  if (inserted > 0) {
    await appendGrowthLeadTimelineEvent(admin, {
      leadId,
      eventType: "multichannel_activity_recorded",
      title: "Multi-channel timeline synced",
      summary: `${inserted} new timeline event(s) recorded.`,
      payload: { inserted, qa_marker: GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER },
    }).catch(() => undefined)
  }

  return inserted
}

export async function fetchMultiChannelActivityTimeline(
  admin: SupabaseClient,
  input: { leadId: string; limit?: number; syncLive?: boolean },
): Promise<{ qaMarker: typeof GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER; entries: GrowthMultichannelActivityEntry[] }> {
  if (input.syncLive !== false) {
    await syncMultiChannelTimelineForLead(admin, input.leadId).catch(() => 0)
  }

  const limit = input.limit ?? 100
  const { data, error } = await admin
    .schema("growth")
    .from("multi_channel_activity_timeline_events")
    .select("id, channel, event_kind, event_source, title, summary, evidence_excerpt, occurred_at, attribution_type, payload")
    .eq("lead_id", input.leadId)
    .order("occurred_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  return {
    qaMarker: GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER,
    entries: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)),
  }
}

export async function fetchGlobalMultiChannelTimelinePreview(
  admin: SupabaseClient,
  input?: { limit?: number },
): Promise<{ qaMarker: typeof GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER; entries: GrowthMultichannelActivityEntry[] }> {
  const limit = input?.limit ?? 50
  const { data, error } = await admin
    .schema("growth")
    .from("multi_channel_activity_timeline_events")
    .select("id, channel, event_kind, event_source, title, summary, evidence_excerpt, occurred_at, attribution_type, payload")
    .order("occurred_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  return {
    qaMarker: GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER,
    entries: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)),
  }
}
