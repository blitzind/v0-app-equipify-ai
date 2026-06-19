import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { insertConversationTimelineEvent } from "@/lib/growth/reply-intelligence/reply-ingestion-repository"
import {
  GROWTH_SEQUENCE_VIDEO_INTELLIGENCE_QA_MARKER,
  type GrowthVideoIntelligenceConversationPreview,
} from "@/lib/growth/sequences/growth-sequence-video-intelligence-types"

type ConversationWriteInput = {
  leadId: string
  videoPageId: string
  videoAssetId: string
  sessionId: string
  pageTitle?: string | null
  videoTitle?: string | null
  completionPercent?: number | null
  ctaLabel?: string | null
  calendarLabel?: string | null
  occurredAt: string
}

function basePayload(input: ConversationWriteInput): Record<string, unknown> {
  return {
    video_page_id: input.videoPageId,
    video_asset_id: input.videoAssetId,
    session_id: input.sessionId,
    page_title: input.pageTitle ?? null,
    video_title: input.videoTitle ?? null,
    completion_percent: input.completionPercent ?? null,
    cta_label: input.ctaLabel ?? null,
    calendar_label: input.calendarLabel ?? null,
    qa_marker: GROWTH_SEQUENCE_VIDEO_INTELLIGENCE_QA_MARKER,
  }
}

async function hasConversationActivity(
  admin: SupabaseClient,
  input: { leadId: string; eventKind: string; sessionId: string; videoPageId: string },
): Promise<boolean> {
  const { count, error } = await admin
    .schema("growth")
    .from("conversation_timeline_events")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", input.leadId)
    .eq("event_kind", input.eventKind)
    .contains("payload", { session_id: input.sessionId, video_page_id: input.videoPageId })

  if (error) throw new Error(error.message)
  return (count ?? 0) > 0
}

export function buildVideoIntelligenceConversationPreviews(input: {
  context: ConversationWriteInput
  metrics: {
    totalViews: number
    highestPercentWatched: number
    totalCtaClicks: number
    totalCalendarClicks: number
  }
}): GrowthVideoIntelligenceConversationPreview[] {
  const pageTitle = input.context.pageTitle?.trim() || "Personalized video page"
  const videoTitle = input.context.videoTitle?.trim() || pageTitle
  const completion = input.context.completionPercent ?? input.metrics.highestPercentWatched
  const previews: GrowthVideoIntelligenceConversationPreview[] = []

  if (input.metrics.totalViews > 0) {
    previews.push({
      eventKind: "video_page_viewed",
      title: "Viewed personalized video",
      summary: `Viewed ${pageTitle}.`,
      payload: basePayload(input.context),
    })
  }
  if (input.metrics.highestPercentWatched >= 25) {
    previews.push({
      eventKind: "video_watched",
      title: "Watched personalized video",
      summary: `Watched ${Math.round(completion)}% of ${videoTitle}.`,
      payload: { ...basePayload(input.context), completion_percent: completion },
    })
  }
  if (input.metrics.totalCtaClicks > 0) {
    previews.push({
      eventKind: "video_cta_clicked",
      title: "Clicked video CTA",
      summary: input.context.ctaLabel
        ? `Clicked "${input.context.ctaLabel}" on ${pageTitle}.`
        : `Clicked CTA on ${pageTitle}.`,
      payload: basePayload(input.context),
    })
  }
  if (input.metrics.totalCalendarClicks > 0) {
    previews.push({
      eventKind: "video_calendar_clicked",
      title: "Clicked video calendar",
      summary: input.context.calendarLabel
        ? `Clicked "${input.context.calendarLabel}" on ${pageTitle}.`
        : `Clicked calendar on ${pageTitle}.`,
      payload: basePayload(input.context),
    })
  }

  return previews
}

export async function syncVideoIntelligenceConversationActivities(
  admin: SupabaseClient,
  input: ConversationWriteInput & { previews: GrowthVideoIntelligenceConversationPreview[] },
): Promise<{ written: number; skipped: number }> {
  let written = 0
  let skipped = 0

  for (const preview of input.previews) {
    const exists = await hasConversationActivity(admin, {
      leadId: input.leadId,
      eventKind: preview.eventKind,
      sessionId: input.sessionId,
      videoPageId: input.videoPageId,
    })
    if (exists) {
      skipped += 1
      continue
    }

    await insertConversationTimelineEvent(admin, {
      leadId: input.leadId,
      eventKind: preview.eventKind,
      eventSource: "growth_video_intelligence_d3",
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
