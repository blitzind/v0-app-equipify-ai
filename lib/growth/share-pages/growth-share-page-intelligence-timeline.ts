import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"
import type { GrowthLeadTimelineEventType } from "@/lib/growth/timeline-types"
import {
  GROWTH_SHARE_PAGE_INTELLIGENCE_QA_MARKER,
  type GrowthSharePageIntelligenceTimelinePreview,
} from "@/lib/growth/share-pages/growth-share-page-intelligence-types"

type SharePageTimelineWriteInput = {
  leadId: string
  sharePageId: string
  sessionId: string
  sequenceExecutionId?: string | null
  sequenceStepId?: string | null
  viewCount?: number | null
  engagementScore?: number | null
  occurredAt?: string | null
}

function basePayload(input: SharePageTimelineWriteInput): Record<string, unknown> {
  return {
    share_page_id: input.sharePageId,
    session_id: input.sessionId,
    view_count: input.viewCount ?? null,
    engagement_score: input.engagementScore ?? null,
    sequence_execution_id: input.sequenceExecutionId ?? null,
    sequence_step_id: input.sequenceStepId ?? null,
    source: "growth_share_page_intelligence_sp_int_1",
    qa_marker: GROWTH_SHARE_PAGE_INTELLIGENCE_QA_MARKER,
  }
}

async function hasSharePageTimelineEvent(
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

export function buildSharePageIntelligenceTimelinePreviews(input: {
  pageTitle?: string | null
  metrics: {
    totalViews: number
    ctaClicks: number
    calendarClicks: number
    sessionCount: number
    sharePageEngagementScore: number
  }
  context: SharePageTimelineWriteInput
}): GrowthSharePageIntelligenceTimelinePreview[] {
  const pageLabel = input.pageTitle?.trim() || "personalized share page"
  const payload = basePayload(input.context)
  const previews: GrowthSharePageIntelligenceTimelinePreview[] = []

  if (input.metrics.totalViews > 0) {
    previews.push({
      eventType: "share_page_viewed",
      title: "Share page viewed",
      summary: `Viewed ${pageLabel}.`,
      payload: { ...payload, event_kind: "page_view" },
    })
  }
  if (input.metrics.ctaClicks > 0) {
    previews.push({
      eventType: "share_page_cta_clicked",
      title: "Share page CTA clicked",
      summary: `Clicked CTA on ${pageLabel}.`,
      payload: { ...payload, event_kind: "cta_click" },
    })
  }
  if (input.metrics.calendarClicks > 0) {
    previews.push({
      eventType: "share_page_calendar_clicked",
      title: "Share page calendar clicked",
      summary: `Clicked calendar on ${pageLabel}.`,
      payload: { ...payload, event_kind: "calendar_click" },
    })
  }
  if (input.metrics.sessionCount > 1) {
    previews.push({
      eventType: "share_page_return_visit",
      title: "Share page return visit",
      summary: `Returned to ${pageLabel}.`,
      payload: { ...payload, event_kind: "return_visit" },
    })
  }
  if (
    input.metrics.sharePageEngagementScore >= 60 ||
    input.metrics.ctaClicks > 0 ||
    input.metrics.calendarClicks > 0
  ) {
    previews.push({
      eventType: "share_page_high_intent",
      title: "Share page high intent",
      summary: `High-intent engagement on ${pageLabel}.`,
      payload: { ...payload, event_kind: "high_intent" },
    })
  }

  return previews
}

export async function syncSharePageIntelligenceTimelineEvents(
  admin: SupabaseClient,
  input: SharePageTimelineWriteInput & { pageTitle?: string | null; previews: GrowthSharePageIntelligenceTimelinePreview[] },
): Promise<{ written: number; skipped: number }> {
  let written = 0
  let skipped = 0

  for (const preview of input.previews) {
    const payloadContains = {
      share_page_id: input.sharePageId,
      session_id: input.sessionId,
      event_kind: preview.payload.event_kind,
    }

    const exists = await hasSharePageTimelineEvent(admin, {
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

export type { SharePageTimelineWriteInput }
