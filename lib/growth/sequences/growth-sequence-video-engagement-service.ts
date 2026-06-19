import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_SEQUENCE_VIDEO_D3_SIGNALS,
  type GrowthSequenceVideoD3Signal,
} from "@/lib/growth/sequences/growth-sequence-video-attachment-types"
import { deriveGrowthVideoIntelligenceSignals } from "@/lib/growth/sequences/growth-sequence-video-intelligence-mappings"
import {
  loadSequenceVideoAttachmentRecord,
  readSequenceVideoAttachmentAnalyticsHooks,
} from "@/lib/growth/sequences/growth-sequence-video-attribution-service"

export type GrowthSequenceVideoEngagementSignalSnapshot = {
  engagementSummaryId: string | null
  signals: GrowthSequenceVideoD3Signal[]
  metadata: Record<string, unknown>
}

function deriveD3SignalsFromSummary(input: {
  totalViews: number
  highestPercentWatched: number
  totalCtaClicks: number
  totalCalendarClicks: number
  visitorSessionCount: number
}): GrowthSequenceVideoD3Signal[] {
  return deriveGrowthVideoIntelligenceSignals({
    totalViews: input.totalViews,
    highestPercentWatched: input.highestPercentWatched,
    totalCtaClicks: input.totalCtaClicks,
    totalCalendarClicks: input.totalCalendarClicks,
    sessionCount: input.visitorSessionCount,
  }).filter((signal) => GROWTH_SEQUENCE_VIDEO_D3_SIGNALS.includes(signal))
}

export async function buildSequenceVideoEngagementSignals(
  admin: SupabaseClient,
  input: {
    organizationId: string
    videoPageId: string
    leadId?: string | null
    visitorIdentifier?: string | null
  },
): Promise<GrowthSequenceVideoEngagementSignalSnapshot> {
  let query = admin
    .schema("growth")
    .from("video_engagement_summaries")
    .select(
      "id, total_views, highest_percent_watched, total_cta_clicks, total_calendar_clicks, visitor_identifier, session_id, metadata_json",
    )
    .eq("organization_id", input.organizationId)
    .eq("video_page_id", input.videoPageId)
    .order("updated_at", { ascending: false })
    .limit(25)

  if (input.visitorIdentifier?.trim()) {
    query = query.eq("visitor_identifier", input.visitorIdentifier.trim())
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = data ?? []
  if (rows.length === 0) {
    return {
      engagementSummaryId: null,
      signals: [],
      metadata: {
        requires_human_review: true,
        autonomous_execution_enabled: false,
        orchestration_enabled: false,
      },
    }
  }

  const totals = rows.reduce(
    (acc, row) => {
      acc.totalViews += Number(row.total_views ?? 0)
      acc.highestPercentWatched = Math.max(
        acc.highestPercentWatched,
        Number(row.highest_percent_watched ?? 0),
      )
      acc.totalCtaClicks += Number(row.total_cta_clicks ?? 0)
      acc.totalCalendarClicks += Number(row.total_calendar_clicks ?? 0)
      return acc
    },
    {
      totalViews: 0,
      highestPercentWatched: 0,
      totalCtaClicks: 0,
      totalCalendarClicks: 0,
    },
  )

  const visitorKeys = new Set<string>()
  for (const row of rows) {
    const key =
      (typeof row.visitor_identifier === "string" && row.visitor_identifier.trim()) ||
      (typeof row.session_id === "string" ? row.session_id : "")
    if (key) visitorKeys.add(key)
  }

  const latest = rows[0]
  const signals = deriveD3SignalsFromSummary({
    ...totals,
    visitorSessionCount: visitorKeys.size,
  })

  return {
    engagementSummaryId: typeof latest.id === "string" ? latest.id : null,
    signals,
    metadata: {
      requires_human_review: true,
      autonomous_execution_enabled: false,
      orchestration_enabled: false,
      lead_id: input.leadId ?? null,
      video_page_id: input.videoPageId,
      signal_count: signals.length,
      latest_summary_id: typeof latest.id === "string" ? latest.id : null,
      ...(latest.metadata_json && typeof latest.metadata_json === "object"
        ? (latest.metadata_json as Record<string, unknown>)
        : {}),
    },
  }
}

export async function listSequenceVideoAttachmentAnalyticsDiagnostics(
  admin: SupabaseClient,
  input: {
    organizationId: string
    attachmentId: string
    leadId?: string | null
  },
): Promise<{
  analyticsHooks: Record<string, string | null> | null
  engagement: GrowthSequenceVideoEngagementSignalSnapshot
}> {
  const attachment = await loadSequenceVideoAttachmentRecord(admin, {
    organizationId: input.organizationId,
    attachmentId: input.attachmentId,
  })
  if (!attachment) throw new Error("not_found")

  const analyticsHooks = await readSequenceVideoAttachmentAnalyticsHooks(admin, {
    organizationId: input.organizationId,
    attachmentId: input.attachmentId,
  })

  const engagement = attachment.videoPageId
    ? await buildSequenceVideoEngagementSignals(admin, {
        organizationId: input.organizationId,
        videoPageId: attachment.videoPageId,
        leadId: input.leadId ?? attachment.metadataHooks.lead_id ?? null,
      })
    : {
        engagementSummaryId: null,
        signals: [] as GrowthSequenceVideoD3Signal[],
        metadata: {
          requires_human_review: true,
          autonomous_execution_enabled: false,
          orchestration_enabled: false,
        },
      }

  return { analyticsHooks, engagement }
}
