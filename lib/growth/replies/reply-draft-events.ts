import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"
import type { GrowthReplyDraftTimelineEventType } from "@/lib/growth/replies/reply-draft-types"
import type { GrowthReplyDraftEvent } from "@/lib/growth/replies/reply-draft-types"

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("inbox_reply_draft_events")
}

function platformTimelineTable(admin: SupabaseClient) {
  return admin.schema("growth").from("platform_timeline_events")
}

export async function insertReplyDraftEvent(
  admin: SupabaseClient,
  input: {
    replyDraftId: string
    eventType: string
    title: string
    description?: string
    severity?: GrowthReplyDraftEvent["severity"]
    metadata?: Record<string, unknown>
  },
): Promise<GrowthReplyDraftEvent> {
  const { data, error } = await eventsTable(admin)
    .insert({
      reply_draft_id: input.replyDraftId,
      event_type: input.eventType,
      severity: input.severity ?? "info",
      title: input.title.slice(0, 200),
      description: (input.description ?? "").slice(0, 500),
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  const row = data as Record<string, unknown>
  return {
    id: String(row.id),
    replyDraftId: String(row.reply_draft_id),
    eventType: String(row.event_type),
    severity: row.severity as GrowthReplyDraftEvent["severity"],
    title: String(row.title),
    description: String(row.description),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  }
}

export async function recordReplyDraftPlatformTimeline(
  admin: SupabaseClient,
  input: {
    eventType: GrowthReplyDraftTimelineEventType
    title: string
    summary?: string
    leadId?: string | null
    threadId?: string | null
    draftId?: string | null
    payload?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await platformTimelineTable(admin).insert({
    connection_id: null,
    event_type: input.eventType,
    title: input.title,
    summary: input.summary ?? null,
    payload: {
      ...(input.payload ?? {}),
      lead_id: input.leadId ?? null,
      thread_id: input.threadId ?? null,
      reply_draft_id: input.draftId ?? null,
      source: "growth_ai_reply_drafting",
    },
  })
  if (error) throw new Error(error.message)
}

export async function recordReplyDraftLeadTimeline(
  admin: SupabaseClient,
  input: {
    leadId: string
    eventType: GrowthReplyDraftTimelineEventType
    title: string
    summary?: string
    draftId?: string | null
    payload?: Record<string, unknown>
  },
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: input.eventType,
    title: input.title,
    summary: input.summary,
    payload: {
      ...(input.payload ?? {}),
      reply_draft_id: input.draftId ?? null,
      source: "growth_ai_reply_drafting",
    },
  })
}
