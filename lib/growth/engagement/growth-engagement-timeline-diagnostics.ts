import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngagementTimeline } from "@/lib/growth/engagement/growth-engagement-timeline-service"
import { probeGrowthEngagementTimelineSourceAvailability } from "@/lib/growth/engagement/growth-engagement-timeline-repository"
import { GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER } from "@/lib/growth/engagement/growth-engagement-timeline-types"
import {
  buildTimelineEventTitle,
  decodeEngagementTimelineCursor,
  encodeEngagementTimelineCursor,
  filterEngagementTimelineEvents,
  GROWTH_ENGAGEMENT_TIMELINE_SAFETY_FLAGS,
  mapMediaEventType,
  mapSharePageEventType,
  paginateEngagementTimelineEvents,
  summarizeLeadDrilldown,
} from "@/lib/growth/engagement/growth-engagement-timeline-utils"
import type { GrowthEngagementTimelineEvent } from "@/lib/growth/engagement/growth-engagement-timeline-types"

export type GrowthEngagementTimelineDiagnosticsResult = {
  qa_marker: typeof GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER
  ok: boolean
  checks: Array<{ name: string; ok: boolean; detail?: string }>
  sourceAvailability: Awaited<ReturnType<typeof probeGrowthEngagementTimelineSourceAvailability>>
}

function sampleEvents(): GrowthEngagementTimelineEvent[] {
  return [
    {
      eventId: "evt-1",
      eventType: "share_page_viewed",
      occurredAt: "2026-06-10T12:00:00.000Z",
      leadId: "lead-1",
      sharePageId: "page-1",
      templateId: "tmpl-1",
      mediaAssetId: null,
      ctaKey: null,
      sessionId: "sess-a",
      title: buildTimelineEventTitle("share_page_viewed"),
      description: "Share page viewed",
      metadata: {},
      source: "share_page_event",
    },
    {
      eventId: "evt-2",
      eventType: "media_completed",
      occurredAt: "2026-06-09T12:00:00.000Z",
      leadId: "lead-1",
      sharePageId: "page-1",
      templateId: "tmpl-1",
      mediaAssetId: "asset-1",
      ctaKey: null,
      sessionId: "sess-b",
      title: buildTimelineEventTitle("media_completed"),
      description: "Media completed",
      metadata: {},
      source: "media_asset_event",
    },
    {
      eventId: "evt-3",
      eventType: "high_intent_detected",
      occurredAt: "2026-06-08T12:00:00.000Z",
      leadId: "lead-1",
      sharePageId: "page-1",
      templateId: null,
      mediaAssetId: null,
      ctaKey: null,
      sessionId: null,
      title: buildTimelineEventTitle("high_intent_detected"),
      description: "High intent",
      metadata: {},
      source: "signal",
    },
  ]
}

export async function runGrowthEngagementTimelineDiagnostics(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GrowthEngagementTimelineDiagnosticsResult> {
  const checks: GrowthEngagementTimelineDiagnosticsResult["checks"] = []

  checks.push({ name: "share_page_event_map", ok: mapSharePageEventType("SHARE_PAGE_VIEWED") === "share_page_viewed" })
  checks.push({ name: "media_event_map", ok: mapMediaEventType("video_completed") === "media_completed" })

  const events = sampleEvents()
  const filtered = filterEngagementTimelineEvents(events, { leadId: "lead-1" })
  checks.push({ name: "lead_filter", ok: filtered.length === 3 })

  const page = paginateEngagementTimelineEvents(events, { limit: 2 })
  checks.push({
    name: "cursor_limit",
    ok: page.returned === 2 && page.hasMore === true && Boolean(page.nextCursor),
  })

  const cursor = page.nextCursor
  const decoded = decodeEngagementTimelineCursor(cursor)
  checks.push({ name: "cursor_roundtrip", ok: Boolean(decoded && encodeEngagementTimelineCursor(decoded) === cursor) })

  const summary = summarizeLeadDrilldown(events, "lead-1")
  checks.push({
    name: "lead_summary",
    ok: summary.sharePageViews === 1 && summary.mediaCompletions === 1 && summary.highIntentSignals === 1,
  })

  checks.push({
    name: "safety_flags",
    ok: GROWTH_ENGAGEMENT_TIMELINE_SAFETY_FLAGS.read_only === true && GROWTH_ENGAGEMENT_TIMELINE_SAFETY_FLAGS.no_db_mutations === true,
  })

  const sourceAvailability = await probeGrowthEngagementTimelineSourceAvailability(admin)
  checks.push({
    name: "source_probe",
    ok: typeof sourceAvailability.share_page_analytics.source_available === "boolean",
  })

  const timeline = await getGrowthEngagementTimeline(admin, {
    organizationId,
    dateRange: "last_30_days",
    limit: 25,
  })
  checks.push({ name: "timeline_service", ok: timeline.qa_marker === GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER })

  return {
    qa_marker: GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER,
    ok: checks.every((check) => check.ok),
    checks,
    sourceAvailability,
  }
}
