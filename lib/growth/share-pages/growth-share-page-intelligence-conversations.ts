import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { insertConversationTimelineEvent } from "@/lib/growth/reply-intelligence/reply-ingestion-repository"
import {
  GROWTH_SHARE_PAGE_INTELLIGENCE_QA_MARKER,
  type GrowthSharePageIntelligenceConversationPreview,
} from "@/lib/growth/share-pages/growth-share-page-intelligence-types"

type ConversationWriteInput = {
  leadId: string
  sharePageId: string
  sessionId: string
  pageTitle?: string | null
  ctaLabel?: string | null
  occurredAt: string
}

function basePayload(input: ConversationWriteInput): Record<string, unknown> {
  return {
    share_page_id: input.sharePageId,
    session_id: input.sessionId,
    page_title: input.pageTitle ?? null,
    cta_label: input.ctaLabel ?? null,
    qa_marker: GROWTH_SHARE_PAGE_INTELLIGENCE_QA_MARKER,
  }
}

async function hasConversationActivity(
  admin: SupabaseClient,
  input: { leadId: string; eventKind: string; sessionId: string; sharePageId: string },
): Promise<boolean> {
  const { count, error } = await admin
    .schema("growth")
    .from("conversation_timeline_events")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", input.leadId)
    .eq("event_kind", input.eventKind)
    .contains("payload", { session_id: input.sessionId, share_page_id: input.sharePageId })

  if (error) throw new Error(error.message)
  return (count ?? 0) > 0
}

export function buildSharePageIntelligenceConversationPreviews(input: {
  context: ConversationWriteInput
  metrics: {
    totalViews: number
    ctaClicks: number
    calendarClicks: number
    sessionCount: number
  }
}): GrowthSharePageIntelligenceConversationPreview[] {
  const pageTitle = input.context.pageTitle?.trim() || "Personalized share page"
  const previews: GrowthSharePageIntelligenceConversationPreview[] = []

  if (input.metrics.totalViews > 0) {
    previews.push({
      eventKind: "share_page_viewed",
      title: "Viewed personalized page",
      summary: `Viewed ${pageTitle}.`,
      payload: basePayload(input.context),
    })
  }
  if (input.metrics.ctaClicks > 0) {
    previews.push({
      eventKind: "share_page_cta_clicked",
      title: "Clicked page CTA",
      summary: input.context.ctaLabel
        ? `Clicked "${input.context.ctaLabel}" on ${pageTitle}.`
        : `Clicked CTA on ${pageTitle}.`,
      payload: basePayload(input.context),
    })
  }
  if (input.metrics.calendarClicks > 0) {
    previews.push({
      eventKind: "share_page_calendar_clicked",
      title: "Clicked calendar",
      summary: `Clicked calendar on ${pageTitle}.`,
      payload: basePayload(input.context),
    })
  }
  if (input.metrics.sessionCount > 1) {
    previews.push({
      eventKind: "share_page_return_visit",
      title: "Returned to page",
      summary: `Returned to ${pageTitle}.`,
      payload: basePayload(input.context),
    })
  }

  return previews
}

export async function syncSharePageIntelligenceConversationActivities(
  admin: SupabaseClient,
  input: ConversationWriteInput & { previews: GrowthSharePageIntelligenceConversationPreview[] },
): Promise<{ written: number; skipped: number }> {
  let written = 0
  let skipped = 0

  for (const preview of input.previews) {
    const exists = await hasConversationActivity(admin, {
      leadId: input.leadId,
      eventKind: preview.eventKind,
      sessionId: input.sessionId,
      sharePageId: input.sharePageId,
    })
    if (exists) {
      skipped += 1
      continue
    }

    await insertConversationTimelineEvent(admin, {
      leadId: input.leadId,
      eventKind: preview.eventKind,
      eventSource: "growth_share_page_intelligence_sp_int_1",
      title: preview.title,
      summary: preview.summary,
      occurredAt: input.occurredAt,
      payload: preview.payload,
      displayRank: 20,
    })
    written += 1
  }

  return { written, skipped }
}

export type { ConversationWriteInput }
