import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById, updateGrowthLeadFromImportMerge } from "@/lib/growth/lead-repository"
import {
  loadSequenceVideoAttachmentRecord,
  patchSequenceVideoAttachmentAnalyticsHooks,
  readSequenceVideoAttachmentAnalyticsHooks,
} from "@/lib/growth/sequences/growth-sequence-video-attribution-service"
import {
  buildGrowthVideoCallWorkspaceContext,
  buildGrowthVideoIntelligenceMetrics,
  buildGrowthVideoMeetingPrepContext,
  buildGrowthVideoOpportunitySignals,
  buildGrowthVideoRelationshipContext,
  deriveGrowthVideoIntelligenceSignals,
  mapGrowthVideoSignalsToNbaSuggestions,
  type GrowthVideoIntelligenceSummaryRow,
} from "@/lib/growth/sequences/growth-sequence-video-intelligence-mappings"
import {
  buildVideoIntelligenceConversationPreviews,
  syncVideoIntelligenceConversationActivities,
} from "@/lib/growth/sequences/growth-sequence-video-intelligence-conversations"
import {
  buildVideoIntelligenceTimelinePreviews,
  syncVideoIntelligenceTimelineEvents,
} from "@/lib/growth/sequences/growth-sequence-video-intelligence-timeline"
import {
  GROWTH_SEQUENCE_VIDEO_INTELLIGENCE_QA_MARKER,
  type GrowthVideoIntelligenceSnapshot,
} from "@/lib/growth/sequences/growth-sequence-video-intelligence-types"
import { createGrowthVideoAnalyticsSummaryService } from "@/lib/growth/videos/growth-video-analytics-summary-service"

type SummaryRow = GrowthVideoIntelligenceSummaryRow

type PageContext = {
  organizationId: string
  videoPageId: string
  videoAssetId: string
  pageTitle: string | null
  videoTitle: string | null
  ctaLabel: string | null
  calendarLabel: string | null
  leadId: string | null
}

export {
  buildGrowthVideoCallWorkspaceContext,
  buildGrowthVideoIntelligenceMetrics,
  buildGrowthVideoMeetingPrepContext,
  buildGrowthVideoOpportunitySignals,
  buildGrowthVideoRelationshipContext,
  deriveGrowthVideoIntelligenceSignals,
  mapGrowthVideoSignalsToNbaSuggestions,
} from "@/lib/growth/sequences/growth-sequence-video-intelligence-mappings"

async function loadEngagementSummaryRows(
  admin: SupabaseClient,
  input: { organizationId: string; videoPageId: string; sessionId?: string | null },
): Promise<SummaryRow[]> {
  let query = admin
    .schema("growth")
    .from("video_engagement_summaries")
    .select(
      "id, video_asset_id, video_page_id, total_views, highest_percent_watched, total_cta_clicks, total_calendar_clicks, last_viewed_at, engagement_score, session_id, visitor_identifier",
    )
    .eq("organization_id", input.organizationId)
    .eq("video_page_id", input.videoPageId)
    .order("updated_at", { ascending: false })
    .limit(25)

  if (input.sessionId?.trim()) {
    query = query.eq("session_id", input.sessionId.trim())
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as SummaryRow[]
}

async function loadPageContext(
  admin: SupabaseClient,
  input: { organizationId: string; videoPageId: string; leadId?: string | null },
): Promise<PageContext> {
  const { data, error } = await admin
    .schema("growth")
    .from("video_pages")
    .select("id, organization_id, video_asset_id, title, cta_label, calendar_url, metadata_json")
    .eq("organization_id", input.organizationId)
    .eq("id", input.videoPageId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("video_page_not_found")

  const metadata = (data.metadata_json ?? {}) as Record<string, unknown>
  let videoTitle: string | null = null
  if (data.video_asset_id) {
    const { data: asset } = await admin
      .schema("growth")
      .from("video_assets")
      .select("title")
      .eq("organization_id", input.organizationId)
      .eq("id", data.video_asset_id)
      .maybeSingle()
    videoTitle = typeof asset?.title === "string" ? asset.title : null
  }

  const metadataLeadId = typeof metadata.lead_id === "string" ? metadata.lead_id : null

  return {
    organizationId: input.organizationId,
    videoPageId: String(data.id),
    videoAssetId: String(data.video_asset_id),
    pageTitle: typeof data.title === "string" ? data.title : null,
    videoTitle,
    ctaLabel: typeof data.cta_label === "string" ? data.cta_label : null,
    calendarLabel: data.calendar_url ? "Schedule a meeting" : null,
    leadId: input.leadId ?? metadataLeadId,
  }
}

async function resolveAttachmentAnalytics(
  admin: SupabaseClient,
  input: { organizationId: string; attachmentId?: string | null; videoPageId: string },
) {
  if (input.attachmentId) {
    return readSequenceVideoAttachmentAnalyticsHooks(admin, {
      organizationId: input.organizationId,
      attachmentId: input.attachmentId,
    })
  }

  const { data } = await admin
    .schema("growth")
    .from("sequence_video_attachments")
    .select("id, metadata_json")
    .eq("organization_id", input.organizationId)
    .eq("video_page_id", input.videoPageId)
    .eq("attachment_status", "approved")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  const metadata = (data.metadata_json ?? {}) as Record<string, unknown>
  const hooks =
    metadata.analytics_hooks && typeof metadata.analytics_hooks === "object"
      ? (metadata.analytics_hooks as Record<string, string | null>)
      : null
  return hooks
}

export async function resolveGrowthVideoIntelligenceSnapshot(
  admin: SupabaseClient,
  input: {
    organizationId: string
    videoPageId: string
    leadId?: string | null
    attachmentId?: string | null
    sessionId?: string | null
  },
): Promise<GrowthVideoIntelligenceSnapshot | null> {
  const page = await loadPageContext(admin, {
    organizationId: input.organizationId,
    videoPageId: input.videoPageId,
    leadId: input.leadId ?? null,
  })

  const rows = await loadEngagementSummaryRows(admin, {
    organizationId: input.organizationId,
    videoPageId: input.videoPageId,
    sessionId: input.sessionId ?? null,
  })
  if (rows.length === 0) return null

  const metrics = buildGrowthVideoIntelligenceMetrics(rows)
  const signals = deriveGrowthVideoIntelligenceSignals({
    totalViews: metrics.totalViews,
    highestPercentWatched: metrics.highestPercentWatched,
    totalCtaClicks: metrics.totalCtaClicks,
    totalCalendarClicks: metrics.totalCalendarClicks,
    sessionCount: metrics.sessionCount,
  })

  const analyticsAttributionRaw = await resolveAttachmentAnalytics(admin, {
    organizationId: input.organizationId,
    attachmentId: input.attachmentId ?? null,
    videoPageId: input.videoPageId,
  })

  const analyticsAttribution = {
    sequence_execution_id: analyticsAttributionRaw?.sequence_execution_id ?? null,
    sequence_step_id: analyticsAttributionRaw?.sequence_step_id ?? null,
    email_send_id: analyticsAttributionRaw?.email_send_id ?? null,
    sms_send_id: analyticsAttributionRaw?.sms_send_id ?? null,
    voice_drop_id: analyticsAttributionRaw?.voice_drop_id ?? null,
    video_page_visit_id: analyticsAttributionRaw?.video_page_visit_id ?? null,
    engagement_summary_id: rows[0]?.id ?? analyticsAttributionRaw?.engagement_summary_id ?? null,
  }

  const timelineContext = {
    leadId: page.leadId ?? "",
    videoPageId: page.videoPageId,
    videoAssetId: page.videoAssetId,
    sessionId: input.sessionId ?? metrics.primarySessionId ?? rows[0]?.session_id ?? "unknown",
    sequenceExecutionId: analyticsAttribution.sequence_execution_id,
    sequenceStepId: analyticsAttribution.sequence_step_id,
    engagementScore: metrics.videoEngagementScore,
    highestPercentWatched: metrics.highestPercentWatched,
    occurredAt: metrics.lastVideoViewedAt,
  }

  const timelineEvents = page.leadId
    ? buildVideoIntelligenceTimelinePreviews({
        pageTitle: page.pageTitle,
        metrics,
        context: timelineContext,
      })
    : []

  const conversationActivities = page.leadId
    ? buildVideoIntelligenceConversationPreviews({
        context: {
          leadId: page.leadId,
          videoPageId: page.videoPageId,
          videoAssetId: page.videoAssetId,
          sessionId: timelineContext.sessionId,
          pageTitle: page.pageTitle,
          videoTitle: page.videoTitle,
          completionPercent: metrics.highestPercentWatched,
          ctaLabel: page.ctaLabel,
          calendarLabel: page.calendarLabel,
          occurredAt: metrics.lastVideoViewedAt ?? new Date().toISOString(),
        },
        metrics,
      })
    : []

  return {
    qa_marker: GROWTH_SEQUENCE_VIDEO_INTELLIGENCE_QA_MARKER,
    metrics,
    signals,
    timelineEvents,
    conversationActivities,
    relationshipContext: buildGrowthVideoRelationshipContext(metrics),
    nextBestActionSuggestions: mapGrowthVideoSignalsToNbaSuggestions({ signals, metrics }),
    opportunitySignals: buildGrowthVideoOpportunitySignals({
      signals,
      metrics,
      videoPageId: page.videoPageId,
      attachmentId: input.attachmentId ?? null,
    }),
    callWorkspaceContext: buildGrowthVideoCallWorkspaceContext({
      metrics,
      pageTitle: page.pageTitle,
      videoTitle: page.videoTitle,
    }),
    meetingPreparationContext: buildGrowthVideoMeetingPrepContext({
      metrics,
      videoTitle: page.videoTitle,
    }),
    analyticsAttribution,
    requiresHumanReview: true,
    autonomousExecutionEnabled: false,
    orchestrationEnabled: false,
  }
}

async function patchLeadVideoIntelligenceMetadata(
  admin: SupabaseClient,
  input: {
    leadId: string
    snapshot: GrowthVideoIntelligenceSnapshot
    pageTitle?: string | null
    videoTitle?: string | null
  },
): Promise<void> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) return

  const existingMetadata =
    lead.metadata && typeof lead.metadata === "object" ? (lead.metadata as Record<string, unknown>) : {}

  await updateGrowthLeadFromImportMerge(admin, input.leadId, {
    metadata: {
      ...existingMetadata,
      growth_video_d3: {
        updated_at: new Date().toISOString(),
        qa_marker: GROWTH_SEQUENCE_VIDEO_INTELLIGENCE_QA_MARKER,
        metrics: input.snapshot.metrics,
        signals: input.snapshot.signals,
        relationship_context: input.snapshot.relationshipContext,
        call_workspace_context: input.snapshot.callWorkspaceContext,
        meeting_preparation_context: input.snapshot.meetingPreparationContext,
        next_best_action_suggestions: input.snapshot.nextBestActionSuggestions,
        opportunity_signals: input.snapshot.opportunitySignals,
        page_title: input.pageTitle ?? null,
        video_title: input.videoTitle ?? null,
        requires_human_review: true,
        autonomous_execution_enabled: false,
        orchestration_enabled: false,
      },
    },
  })
}

export async function syncGrowthVideoEngagementIntelligence(
  admin: SupabaseClient,
  input: {
    organizationId: string
    videoPageId: string
    leadId?: string | null
    attachmentId?: string | null
    sessionId?: string | null
  },
): Promise<
  | { ok: true; snapshot: GrowthVideoIntelligenceSnapshot; writes: Record<string, number> }
  | { ok: false; reason: string }
> {
  const snapshot = await resolveGrowthVideoIntelligenceSnapshot(admin, input)
  if (!snapshot) return { ok: false, reason: "no_engagement_summaries" }

  const page = await loadPageContext(admin, {
    organizationId: input.organizationId,
    videoPageId: input.videoPageId,
    leadId: input.leadId ?? null,
  })

  const sessionId =
    input.sessionId?.trim() ||
    snapshot.metrics.primarySessionId ||
    (await loadEngagementSummaryRows(admin, {
      organizationId: input.organizationId,
      videoPageId: input.videoPageId,
      sessionId: null,
    }))[0]?.session_id

  if (!sessionId) return { ok: false, reason: "missing_session_id" }

  const writes: Record<string, number> = {
    timeline_written: 0,
    timeline_skipped: 0,
    conversation_written: 0,
    conversation_skipped: 0,
    metadata_patched: 0,
    analytics_hooks_patched: 0,
  }

  if (page.leadId) {
    const timelineResult = await syncVideoIntelligenceTimelineEvents(admin, {
      leadId: page.leadId,
      videoPageId: page.videoPageId,
      videoAssetId: page.videoAssetId,
      sessionId,
      sequenceExecutionId: snapshot.analyticsAttribution.sequence_execution_id,
      sequenceStepId: snapshot.analyticsAttribution.sequence_step_id,
      engagementScore: snapshot.metrics.videoEngagementScore,
      highestPercentWatched: snapshot.metrics.highestPercentWatched,
      occurredAt: snapshot.metrics.lastVideoViewedAt,
      pageTitle: page.pageTitle,
      previews: snapshot.timelineEvents,
    })
    writes.timeline_written = timelineResult.written
    writes.timeline_skipped = timelineResult.skipped

    const conversationResult = await syncVideoIntelligenceConversationActivities(admin, {
      leadId: page.leadId,
      videoPageId: page.videoPageId,
      videoAssetId: page.videoAssetId,
      sessionId,
      pageTitle: page.pageTitle,
      videoTitle: page.videoTitle,
      completionPercent: snapshot.metrics.highestPercentWatched,
      ctaLabel: page.ctaLabel,
      calendarLabel: page.calendarLabel,
      occurredAt: snapshot.metrics.lastVideoViewedAt ?? new Date().toISOString(),
      previews: snapshot.conversationActivities,
    })
    writes.conversation_written = conversationResult.written
    writes.conversation_skipped = conversationResult.skipped

    await patchLeadVideoIntelligenceMetadata(admin, {
      leadId: page.leadId,
      snapshot,
      pageTitle: page.pageTitle,
      videoTitle: page.videoTitle,
    })
    writes.metadata_patched = 1
  }

  const attachmentId =
    input.attachmentId ??
    (
      await admin
        .schema("growth")
        .from("sequence_video_attachments")
        .select("id")
        .eq("organization_id", input.organizationId)
        .eq("video_page_id", input.videoPageId)
        .eq("attachment_status", "approved")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ).data?.id

  if (attachmentId) {
    await patchSequenceVideoAttachmentAnalyticsHooks(admin, {
      organizationId: input.organizationId,
      attachmentId: String(attachmentId),
      engagement_summary_id: snapshot.analyticsAttribution.engagement_summary_id,
      sequence_execution_id: snapshot.analyticsAttribution.sequence_execution_id,
      sequence_step_id: snapshot.analyticsAttribution.sequence_step_id,
    })
    writes.analytics_hooks_patched = 1
  }

  return { ok: true, snapshot, writes }
}

export async function readGrowthVideoIntelligenceFromLeadMetadata(
  leadMetadata: Record<string, unknown> | null | undefined,
): Promise<Partial<GrowthVideoIntelligenceSnapshot> | null> {
  const raw = leadMetadata?.growth_video_d3
  if (!raw || typeof raw !== "object") return null
  return raw as Partial<GrowthVideoIntelligenceSnapshot>
}

export async function loadGrowthVideoIntelligenceForAttachment(
  admin: SupabaseClient,
  input: { organizationId: string; attachmentId: string; leadId?: string | null },
): Promise<GrowthVideoIntelligenceSnapshot | null> {
  const attachment = await loadSequenceVideoAttachmentRecord(admin, {
    organizationId: input.organizationId,
    attachmentId: input.attachmentId,
  })
  if (!attachment?.videoPageId) return null

  return resolveGrowthVideoIntelligenceSnapshot(admin, {
    organizationId: input.organizationId,
    videoPageId: attachment.videoPageId,
    leadId: input.leadId ?? attachment.metadataHooks.lead_id ?? null,
    attachmentId: attachment.id,
  })
}

export async function processGrowthVideoPageEventIntelligence(
  admin: SupabaseClient,
  input: {
    organizationId: string
    videoPageId: string
    sessionId: string
    leadId?: string | null
    attachmentId?: string | null
  },
): Promise<
  | { ok: true; snapshot: GrowthVideoIntelligenceSnapshot; writes: Record<string, number> }
  | { ok: false; reason: string }
> {
  const analytics = createGrowthVideoAnalyticsSummaryService(admin)
  const rebuild = await analytics.rebuildSummariesFromEvents({
    organizationId: input.organizationId,
    videoPageId: input.videoPageId,
  })
  if (!rebuild.ok) return { ok: false, reason: rebuild.error }

  return syncGrowthVideoEngagementIntelligence(admin, input)
}
