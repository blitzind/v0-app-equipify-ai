import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"
import type { GrowthLeadTimelineEventType } from "@/lib/growth/timeline-types"
import {
  GROWTH_SEQUENCE_VIDEO_INTELLIGENCE_QA_MARKER,
  type GrowthVideoIntelligenceTimelineEventType,
  type GrowthVideoIntelligenceTimelinePreview,
} from "@/lib/growth/sequences/growth-sequence-video-intelligence-types"

type VideoTimelineWriteInput = {
  leadId: string
  videoPageId: string
  videoAssetId: string
  sessionId: string
  sequenceExecutionId?: string | null
  sequenceStepId?: string | null
  engagementScore?: number | null
  highestPercentWatched?: number | null
  occurredAt?: string | null
}

function basePayload(input: VideoTimelineWriteInput): Record<string, unknown> {
  return {
    video_page_id: input.videoPageId,
    video_asset_id: input.videoAssetId,
    session_id: input.sessionId,
    sequence_execution_id: input.sequenceExecutionId ?? null,
    sequence_step_id: input.sequenceStepId ?? null,
    engagement_score: input.engagementScore ?? null,
    highest_percent_watched: input.highestPercentWatched ?? null,
    source: "growth_video_intelligence_d3",
    qa_marker: GROWTH_SEQUENCE_VIDEO_INTELLIGENCE_QA_MARKER,
  }
}

async function hasVideoTimelineEvent(
  admin: SupabaseClient,
  input: {
    leadId: string
    eventType: GrowthLeadTimelineEventType
    payloadContains: Record<string, unknown>
  },
): Promise<boolean> {
  const { count, error } = await admin
    .schema("growth")
    .from("lead_timeline_events")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", input.leadId)
    .eq("event_type", input.eventType)
    .contains("payload", input.payloadContains)

  if (error) throw new Error(error.message)
  return (count ?? 0) > 0
}

export function buildVideoIntelligenceTimelinePreviews(input: {
  pageTitle?: string | null
  metrics: {
    totalViews: number
    highestPercentWatched: number
    totalCtaClicks: number
    totalCalendarClicks: number
  }
  context: VideoTimelineWriteInput
}): GrowthVideoIntelligenceTimelinePreview[] {
  const pageLabel = input.pageTitle?.trim() || "personalized video page"
  const payload = basePayload(input.context)
  const previews: GrowthVideoIntelligenceTimelinePreview[] = []

  if (input.metrics.totalViews > 0) {
    previews.push({
      eventType: "video_page_viewed",
      title: "Video page viewed",
      summary: `Viewed ${pageLabel}.`,
      payload: { ...payload, event_kind: "page_view" },
    })
  }
  if (input.metrics.highestPercentWatched > 0) {
    previews.push({
      eventType: "video_video_played",
      title: "Personalized video played",
      summary: `Started watching ${pageLabel}.`,
      payload: { ...payload, event_kind: "video_play" },
    })
  }
  if (input.metrics.highestPercentWatched >= 90) {
    previews.push({
      eventType: "video_video_completed",
      title: "Personalized video completed",
      summary: `Watched ${Math.round(input.metrics.highestPercentWatched)}% of ${pageLabel}.`,
      payload: { ...payload, event_kind: "video_complete" },
    })
  }
  if (input.metrics.totalCtaClicks > 0) {
    previews.push({
      eventType: "video_cta_clicked",
      title: "Video CTA clicked",
      summary: `Clicked CTA on ${pageLabel}.`,
      payload: { ...payload, event_kind: "cta_click" },
    })
  }
  if (input.metrics.totalCalendarClicks > 0) {
    previews.push({
      eventType: "video_calendar_clicked",
      title: "Video calendar clicked",
      summary: `Clicked calendar on ${pageLabel}.`,
      payload: { ...payload, event_kind: "calendar_click" },
    })
  }

  return previews
}

export async function syncVideoIntelligenceTimelineEvents(
  admin: SupabaseClient,
  input: VideoTimelineWriteInput & { pageTitle?: string | null; previews: GrowthVideoIntelligenceTimelinePreview[] },
): Promise<{ written: number; skipped: number }> {
  let written = 0
  let skipped = 0

  for (const preview of input.previews) {
    const payloadContains = {
      video_page_id: input.videoPageId,
      session_id: input.sessionId,
      event_kind: preview.payload.event_kind,
    }

    const exists = await hasVideoTimelineEvent(admin, {
      leadId: input.leadId,
      eventType: preview.eventType as GrowthLeadTimelineEventType,
      payloadContains,
    })
    if (exists) {
      skipped += 1
      continue
    }

    await appendGrowthLeadTimelineEvent(admin, {
      leadId: input.leadId,
      eventType: preview.eventType as GrowthLeadTimelineEventType,
      title: preview.title,
      summary: preview.summary,
      payload: preview.payload,
      occurredAt: input.occurredAt ?? undefined,
    })
    written += 1
  }

  return { written, skipped }
}

export type { VideoTimelineWriteInput, GrowthVideoIntelligenceTimelineEventType }
