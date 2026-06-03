import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { listGrowthLeadTimelineEvents } from "@/lib/growth/timeline-repository"
import {
  GROWTH_REVENUE_EXECUTION_QA_MARKER,
  GROWTH_REVENUE_EXECUTION_TIMELINE_METADATA_KEY,
  type GrowthRevenueTimelineEntry,
} from "@/lib/growth/revenue-execution/revenue-execution-types"

const REPLY_EVENT_TYPES = new Set(["email_replied", "reply_received", "reply_classified", "reply_draft_sent"])
const CALL_EVENT_TYPES = new Set(["call_started", "call_attempted", "interested", "voicemail_left"])
const MEETING_EVENT_TYPES = new Set([
  "meeting_requested",
  "meeting_created",
  "meeting_scheduled",
  "meeting_completed",
  "meeting_no_show",
  "meeting_canceled",
])

function readMetadataTimeline(metadata: Record<string, unknown> | null | undefined): GrowthRevenueTimelineEntry[] {
  const raw = metadata?.[GROWTH_REVENUE_EXECUTION_TIMELINE_METADATA_KEY]
  if (!Array.isArray(raw)) return []
  return raw.filter((entry) => entry && typeof entry === "object") as GrowthRevenueTimelineEntry[]
}

function categorizeTimelineEvent(eventType: string): GrowthRevenueTimelineEntry["category"] {
  if (REPLY_EVENT_TYPES.has(eventType)) return "reply"
  if (CALL_EVENT_TYPES.has(eventType)) return "call"
  if (MEETING_EVENT_TYPES.has(eventType)) return "meeting"
  if (eventType.includes("opportunity") || eventType.includes("forecast") || eventType.includes("readiness"))
    return "revenue_readiness"
  return "other"
}

export async function appendRevenueExecutionTimelineEntry(
  admin: SupabaseClient,
  leadId: string,
  entry: Omit<GrowthRevenueTimelineEntry, "id">,
): Promise<void> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return

  const existing = readMetadataTimeline(lead.metadata)
  const next: GrowthRevenueTimelineEntry[] = [
    {
      ...entry,
      id: `rev-${Date.now()}-${existing.length}`,
    },
    ...existing,
  ].slice(0, 100)

  await admin
    .schema("growth")
    .from("leads")
    .update({
      metadata: {
        ...(lead.metadata ?? {}),
        [GROWTH_REVENUE_EXECUTION_TIMELINE_METADATA_KEY]: next,
      },
    })
    .eq("id", leadId)
}

export async function fetchRevenueExecutionTimeline(
  admin: SupabaseClient,
  leadId: string,
  limit = 50,
): Promise<{ qaMarker: typeof GROWTH_REVENUE_EXECUTION_QA_MARKER; entries: GrowthRevenueTimelineEntry[] }> {
  const [lead, timelineEvents, recRes, crmRes] = await Promise.all([
    fetchGrowthLeadById(admin, leadId),
    listGrowthLeadTimelineEvents(admin, { leadId, limit: 80 }),
    admin
      .schema("growth")
      .from("opportunity_recommendations")
      .select("id, title, description, status, created_at, updated_at, metadata")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .schema("growth")
      .from("crm_intelligence_events")
      .select("event_type, title, description, created_at, metadata")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(30)
      .catch(() => ({ data: [], error: null })),
  ])

  const entries: GrowthRevenueTimelineEntry[] = []

  for (const event of timelineEvents) {
    entries.push({
      id: event.id,
      occurredAt: event.occurredAt,
      category: categorizeTimelineEvent(event.eventType),
      title: event.title,
      summary: event.summary ?? event.eventType.replace(/_/g, " "),
      metadata: { eventType: event.eventType, source: "lead_timeline" },
    })
  }

  for (const row of recRes.data ?? []) {
    const r = row as Record<string, unknown>
    entries.push({
      id: String(r.id),
      occurredAt: String(r.updated_at ?? r.created_at),
      category: "opportunity_recommendation",
      title: String(r.title),
      summary: `${String(r.status)} — ${String(r.description ?? "")}`.trim(),
      metadata: { status: r.status, ...(r.metadata as Record<string, unknown>) },
    })
  }

  for (const row of crmRes.data ?? []) {
    const r = row as Record<string, unknown>
    if (!String(r.event_type).includes("recommendation") && !String(r.event_type).includes("signal")) continue
    entries.push({
      id: `crm-${String(r.created_at)}-${String(r.event_type)}`,
      occurredAt: String(r.created_at),
      category: "opportunity_recommendation",
      title: String(r.title),
      summary: String(r.description ?? r.event_type),
      metadata: { source: "crm_intelligence" },
    })
  }

  if (lead) {
    for (const entry of readMetadataTimeline(lead.metadata)) {
      entries.push(entry)
    }
  }

  entries.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())

  return {
    qaMarker: GROWTH_REVENUE_EXECUTION_QA_MARKER,
    entries: entries.slice(0, limit),
  }
}
