import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeGrowthActorUserIdForDb, resolveGrowthActorForDb } from "@/lib/growth/actor-user-id"
import type {
  GrowthInboxTimelineEventType,
  GrowthReplyEventSeverity,
  GrowthReplyIntelligenceEvent,
} from "@/lib/growth/inbox/inbox-types"
import type { ReplyEventDraft } from "@/lib/growth/inbox/reply-event-builder"
import { formatLeadLabel } from "@/lib/growth/lead-label"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("reply_intelligence_events")
}

function timelineTable(admin: SupabaseClient) {
  return admin.schema("growth").from("platform_timeline_events")
}

function mapEvent(row: Record<string, unknown>, leadLabel = ""): GrowthReplyIntelligenceEvent {
  return {
    id: asString(row.id),
    thread_id: asString(row.thread_id),
    lead_label: leadLabel,
    severity: asString(row.severity) as GrowthReplyEventSeverity,
    event_type: asString(row.event_type) || "reply_detected",
    title: asString(row.title),
    description: asString(row.description),
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {},
    created_at: asString(row.created_at),
  }
}

async function loadLeadLabelsForThreads(admin: SupabaseClient, threadIds: string[]): Promise<Map<string, string>> {
  const labels = new Map<string, string>()
  if (threadIds.length === 0) return labels

  const { data: threads } = await admin.schema("growth").from("inbox_threads").select("id, lead_id").in("id", threadIds)
  const leadIds = [...new Set((threads ?? []).map((row) => asString((row as Record<string, unknown>).lead_id)).filter(Boolean))]
  const companyByLead = new Map<string, string>()
  if (leadIds.length > 0) {
    const { data: leads } = await admin.schema("growth").from("leads").select("id, company_name").in("id", leadIds)
    for (const row of leads ?? []) {
      const record = row as Record<string, unknown>
      companyByLead.set(asString(record.id), asString(record.company_name))
    }
  }

  for (const row of threads ?? []) {
    const record = row as Record<string, unknown>
    const threadId = asString(record.id)
    const leadId = asString(record.lead_id)
    labels.set(threadId, formatLeadLabel(companyByLead.get(leadId)))
  }

  return labels
}

export async function createReplyIntelligenceEvent(
  admin: SupabaseClient,
  input: {
    thread_id: string
    event_type: string
    severity: GrowthReplyEventSeverity
    title: string
    description: string
    metadata?: Record<string, unknown>
  },
): Promise<GrowthReplyIntelligenceEvent> {
  const { data, error } = await eventsTable(admin)
    .insert({
      thread_id: input.thread_id,
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

export async function listReplyIntelligenceEvents(
  admin: SupabaseClient,
  input?: { limit?: number; thread_id?: string },
): Promise<GrowthReplyIntelligenceEvent[]> {
  let query = eventsTable(admin).select("*").order("created_at", { ascending: false }).limit(input?.limit ?? 50)
  if (input?.thread_id) query = query.eq("thread_id", input.thread_id)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const threadIds = [...new Set((data ?? []).map((row) => asString((row as Record<string, unknown>).thread_id)).filter(Boolean))]
  const leadLabels = await loadLeadLabelsForThreads(admin, threadIds)

  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>
    return mapEvent(record, leadLabels.get(asString(record.thread_id)) ?? "")
  })
}

export async function appendInboxTimelineEvent(
  admin: SupabaseClient,
  input: {
    eventType: GrowthInboxTimelineEventType
    title: string
    summary?: string | null
    threadId?: string | null
    leadId?: string | null
    payload?: Record<string, unknown>
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<void> {
  const actorUserId = normalizeGrowthActorUserIdForDb(input.actorUserId)
  const { error } = await timelineTable(admin).insert({
    connection_id: null,
    event_type: input.eventType,
    title: input.title,
    summary: input.summary ?? null,
    payload: {
      ...(input.payload ?? {}),
      thread_id: input.threadId ?? null,
      lead_id: input.leadId ?? null,
    },
    actor_user_id: actorUserId,
    actor_email: input.actorEmail?.trim() ? input.actorEmail.trim() : null,
  })
  if (error) throw new Error(error.message)
}

export async function persistReplyEventDrafts(
  admin: SupabaseClient,
  threadId: string,
  leadId: string,
  drafts: ReplyEventDraft[],
  actor?: { actorUserId?: string | null; actorEmail?: string | null },
): Promise<void> {
  const actor = resolveGrowthActorForDb(actor)
  for (const draft of drafts) {
    await createReplyIntelligenceEvent(admin, {
      thread_id: threadId,
      event_type: draft.event_type,
      severity: draft.severity,
      title: draft.title,
      description: draft.description,
      metadata: draft.metadata,
    })
    if (draft.timeline_type) {
      await appendInboxTimelineEvent(admin, {
        eventType: draft.timeline_type,
        title: draft.title,
        summary: draft.description,
        threadId,
        leadId,
        payload: draft.metadata,
        actorUserId: actor.actorUserId,
        actorEmail: actor.actorEmail,
      })
    }
  }
}
