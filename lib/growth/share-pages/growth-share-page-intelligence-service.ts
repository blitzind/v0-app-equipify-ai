/** Growth Engine SP-INT-1 — Share page intelligence assembly + sync (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById, updateGrowthLeadFromImportMerge } from "@/lib/growth/lead-repository"
import { buildGrowthSharePageAnalyticsAttribution } from "@/lib/growth/share-pages/growth-share-page-attribution-service"
import { buildGrowthSharePageEngagementSignals } from "@/lib/growth/share-pages/growth-share-page-engagement-service"
import {
  buildSharePageIntelligenceConversationPreviews,
  syncSharePageIntelligenceConversationActivities,
} from "@/lib/growth/share-pages/growth-share-page-intelligence-conversations"
import {
  buildGrowthSharePageCallWorkspaceContext,
  buildGrowthSharePageIntelligenceEngagementSummary,
  buildGrowthSharePageMeetingPrepContext,
  buildGrowthSharePageOpportunitySignals,
  buildGrowthSharePageRelationshipContext,
  mapGrowthSharePageSignalsToNbaSuggestions,
} from "@/lib/growth/share-pages/growth-share-page-intelligence-mappings"
import {
  buildSharePageIntelligenceTimelinePreviews,
  syncSharePageIntelligenceTimelineEvents,
} from "@/lib/growth/share-pages/growth-share-page-intelligence-timeline"
import {
  GROWTH_SHARE_PAGE_INTELLIGENCE_METADATA_KEY,
  GROWTH_SHARE_PAGE_INTELLIGENCE_QA_MARKER,
  type GrowthSharePageIntelligenceApiResponse,
  type GrowthSharePageIntelligenceMetadata,
  type GrowthSharePageIntelligenceSnapshot,
} from "@/lib/growth/share-pages/growth-share-page-intelligence-types"
import { fetchGrowthSharePageById } from "@/lib/growth/share-pages/share-page-repository"

export {
  buildGrowthSharePageCallWorkspaceContext,
  buildGrowthSharePageMeetingPrepContext,
  buildGrowthSharePageRelationshipContext,
  mapGrowthSharePageSignalsToNbaSuggestions,
  readGrowthSharePageCallWorkspaceFromLeadMetadata,
  readGrowthSharePageMeetingPrepFromLeadMetadata,
} from "@/lib/growth/share-pages/growth-share-page-intelligence-mappings"

function toApiResponse(snapshot: GrowthSharePageIntelligenceSnapshot): GrowthSharePageIntelligenceApiResponse {
  return {
    relationship_context: snapshot.relationshipContext,
    meeting_preparation_context: snapshot.meetingPreparationContext,
    call_workspace_context: snapshot.callWorkspaceContext,
    nba_suggestions: snapshot.nextBestActionSuggestions,
    opportunity_signals: snapshot.opportunitySignals,
    timeline: snapshot.timelineEvents,
    activities: snapshot.conversationActivities,
    engagement_summary: snapshot.engagementSummary,
    metrics: snapshot.metrics,
    signals: snapshot.signals,
    analytics_attribution: snapshot.analyticsAttribution,
  }
}

export async function resolveGrowthSharePageIntelligenceSnapshot(
  admin: SupabaseClient,
  input: {
    organizationId: string
    sharePageId: string
    leadId?: string | null
    sessionId?: string | null
  },
): Promise<GrowthSharePageIntelligenceSnapshot | null> {
  const page = await fetchGrowthSharePageById(admin, input.sharePageId)
  if (!page || page.organizationId !== input.organizationId) return null
  if (input.leadId && page.leadId !== input.leadId) return null

  const engagement = await buildGrowthSharePageEngagementSignals(admin, {
    sharePageId: input.sharePageId,
    sessionId: input.sessionId ?? null,
  })
  if (!engagement) return null

  const analyticsAttribution = buildGrowthSharePageAnalyticsAttribution(page)
  const relationshipContext = buildGrowthSharePageRelationshipContext(engagement.metrics)
  const engagementSummary = buildGrowthSharePageIntelligenceEngagementSummary(engagement.metrics)
  const pageTitle = page.headline?.trim() || null
  const ctaLabel = page.ctaConfig[0]?.label ?? null

  const timelineContext = {
    leadId: page.leadId,
    sharePageId: page.id,
    sessionId: input.sessionId ?? engagement.primarySessionId ?? "unknown",
    sequenceExecutionId: analyticsAttribution.sequence_execution_id,
    sequenceStepId: analyticsAttribution.sequence_step_id,
    viewCount: engagement.metrics.totalViews,
    engagementScore: engagement.metrics.sharePageEngagementScore,
    occurredAt: engagement.metrics.lastSharePageViewedAt,
  }

  const timelineEvents = buildSharePageIntelligenceTimelinePreviews({
    pageTitle,
    metrics: engagement.metrics,
    context: timelineContext,
  })

  const conversationActivities = buildSharePageIntelligenceConversationPreviews({
    context: {
      leadId: page.leadId,
      sharePageId: page.id,
      sessionId: timelineContext.sessionId,
      pageTitle,
      ctaLabel,
      occurredAt: engagement.metrics.lastSharePageViewedAt ?? new Date().toISOString(),
    },
    metrics: engagement.metrics,
  })

  return {
    qa_marker: GROWTH_SHARE_PAGE_INTELLIGENCE_QA_MARKER,
    metrics: engagement.metrics,
    signals: engagement.signals,
    timelineEvents,
    conversationActivities,
    relationshipContext,
    nextBestActionSuggestions: mapGrowthSharePageSignalsToNbaSuggestions({
      signals: engagement.signals,
      metrics: engagement.metrics,
    }),
    opportunitySignals: buildGrowthSharePageOpportunitySignals({
      signals: engagement.signals,
      metrics: engagement.metrics,
      sharePageId: page.id,
    }),
    callWorkspaceContext: buildGrowthSharePageCallWorkspaceContext({
      metrics: engagement.metrics,
      pageTitle,
    }),
    meetingPreparationContext: buildGrowthSharePageMeetingPrepContext({
      metrics: engagement.metrics,
      pageTitle,
    }),
    engagementSummary,
    analyticsAttribution,
    requiresHumanReview: true,
    autonomousExecutionEnabled: false,
    orchestrationEnabled: false,
  }
}

async function patchLeadSharePageIntelligenceMetadata(
  admin: SupabaseClient,
  input: {
    leadId: string
    sharePageId: string
    snapshot: GrowthSharePageIntelligenceSnapshot
  },
): Promise<void> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) return

  const existingMetadata =
    lead.metadata && typeof lead.metadata === "object" ? (lead.metadata as Record<string, unknown>) : {}

  const nextBlock: GrowthSharePageIntelligenceMetadata = {
    qa_marker: GROWTH_SHARE_PAGE_INTELLIGENCE_QA_MARKER,
    updated_at: new Date().toISOString(),
    share_page_id: input.sharePageId,
    relationship_context: input.snapshot.relationshipContext,
    meeting_preparation_context: input.snapshot.meetingPreparationContext,
    call_workspace_context: input.snapshot.callWorkspaceContext,
    nba_suggestions: input.snapshot.nextBestActionSuggestions,
    opportunity_signals: input.snapshot.opportunitySignals,
    engagement_summary: input.snapshot.engagementSummary,
    metrics: input.snapshot.metrics,
    signals: input.snapshot.signals,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    orchestration_enabled: false,
  }

  await updateGrowthLeadFromImportMerge(admin, input.leadId, {
    metadata: {
      ...existingMetadata,
      [GROWTH_SHARE_PAGE_INTELLIGENCE_METADATA_KEY]: nextBlock,
    },
  })
}

export async function syncGrowthSharePageEngagementIntelligence(
  admin: SupabaseClient,
  input: {
    organizationId: string
    sharePageId: string
    leadId?: string | null
    sessionId?: string | null
  },
): Promise<
  | { ok: true; snapshot: GrowthSharePageIntelligenceSnapshot; writes: Record<string, number> }
  | { ok: false; reason: string }
> {
  const snapshot = await resolveGrowthSharePageIntelligenceSnapshot(admin, input)
  if (!snapshot) return { ok: false, reason: "no_share_page_engagement" }

  const page = await fetchGrowthSharePageById(admin, input.sharePageId)
  if (!page) return { ok: false, reason: "share_page_not_found" }

  const sessionId = input.sessionId?.trim() || snapshot.metrics.primarySessionId
  if (!sessionId) return { ok: false, reason: "missing_session_id" }

  const writes: Record<string, number> = {
    timeline_written: 0,
    timeline_skipped: 0,
    conversation_written: 0,
    conversation_skipped: 0,
    metadata_patched: 0,
  }

  const pageTitle = page.headline?.trim() || null
  const ctaLabel = page.ctaConfig[0]?.label ?? null

  const timelineResult = await syncSharePageIntelligenceTimelineEvents(admin, {
    leadId: page.leadId,
    sharePageId: page.id,
    sessionId,
    sequenceExecutionId: snapshot.analyticsAttribution.sequence_execution_id,
    sequenceStepId: snapshot.analyticsAttribution.sequence_step_id,
    viewCount: snapshot.metrics.totalViews,
    engagementScore: snapshot.metrics.sharePageEngagementScore,
    occurredAt: snapshot.metrics.lastSharePageViewedAt,
    pageTitle,
    previews: snapshot.timelineEvents,
  })
  writes.timeline_written = timelineResult.written
  writes.timeline_skipped = timelineResult.skipped

  const conversationResult = await syncSharePageIntelligenceConversationActivities(admin, {
    leadId: page.leadId,
    sharePageId: page.id,
    sessionId,
    pageTitle,
    ctaLabel,
    occurredAt: snapshot.metrics.lastSharePageViewedAt ?? new Date().toISOString(),
    previews: snapshot.conversationActivities,
  })
  writes.conversation_written = conversationResult.written
  writes.conversation_skipped = conversationResult.skipped

  await patchLeadSharePageIntelligenceMetadata(admin, {
    leadId: page.leadId,
    sharePageId: page.id,
    snapshot,
  })
  writes.metadata_patched = 1

  return { ok: true, snapshot, writes }
}

export async function processGrowthSharePageEventIntelligence(
  admin: SupabaseClient,
  input: {
    organizationId: string
    sharePageId: string
    leadId?: string | null
    sessionId?: string | null
  },
): Promise<
  | { ok: true; snapshot: GrowthSharePageIntelligenceSnapshot; writes: Record<string, number> }
  | { ok: false; reason: string }
> {
  return syncGrowthSharePageEngagementIntelligence(admin, input)
}

export async function readGrowthSharePageIntelligenceFromLeadMetadata(
  leadMetadata: Record<string, unknown> | null | undefined,
): Promise<Partial<GrowthSharePageIntelligenceMetadata> | null> {
  const raw = leadMetadata?.[GROWTH_SHARE_PAGE_INTELLIGENCE_METADATA_KEY]
  if (!raw || typeof raw !== "object") return null
  return raw as Partial<GrowthSharePageIntelligenceMetadata>
}

export async function loadGrowthSharePageIntelligenceResponse(
  admin: SupabaseClient,
  input: {
    organizationId: string
    sharePageId?: string | null
    leadId?: string | null
    sessionId?: string | null
  },
): Promise<GrowthSharePageIntelligenceApiResponse | null> {
  if (!input.sharePageId) {
    if (!input.leadId) return null
    const lead = await fetchGrowthLeadById(admin, input.leadId)
    const cached = await readGrowthSharePageIntelligenceFromLeadMetadata(lead?.metadata)
    if (!cached?.relationship_context) return null
    return {
      relationship_context: cached.relationship_context,
      meeting_preparation_context: cached.meeting_preparation_context,
      call_workspace_context: cached.call_workspace_context,
      nba_suggestions: cached.nba_suggestions ?? [],
      opportunity_signals: cached.opportunity_signals ?? [],
      timeline: [],
      activities: [],
      engagement_summary: cached.engagement_summary,
      metrics: cached.metrics ?? {
        totalViews: cached.engagement_summary.viewCount,
        uniqueVisitors: cached.engagement_summary.uniqueVisitors,
        ctaClicks: cached.engagement_summary.ctaClicks,
        calendarClicks: cached.engagement_summary.calendarClicks,
        avgDurationMs: 0,
        lastSharePageViewedAt: cached.engagement_summary.lastActivityAt,
        lastSharePageId: cached.share_page_id,
        sharePageEngagementScore: 0,
        sessionCount: 0,
        primarySessionId: input.sessionId ?? null,
      },
      signals: cached.signals ?? [],
      analytics_attribution: {
        sequence_execution_id: null,
        sequence_step_id: null,
        sequence_enrollment_step_id: null,
        enrollment_id: null,
        share_page_id: cached.share_page_id,
      },
    }
  }

  const snapshot = await resolveGrowthSharePageIntelligenceSnapshot(admin, {
    organizationId: input.organizationId,
    sharePageId: input.sharePageId,
    leadId: input.leadId ?? null,
    sessionId: input.sessionId ?? null,
  })
  if (!snapshot) return null
  return toApiResponse(snapshot)
}
