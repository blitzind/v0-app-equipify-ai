import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchEngagementTimelineEvents,
  fetchMediaDrilldownMeta,
  fetchSharePageDrilldownMeta,
  fetchTemplateDrilldownMeta,
  probeGrowthEngagementTimelineSourceAvailability,
} from "@/lib/growth/engagement/growth-engagement-timeline-repository"
import {
  GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER,
  type GrowthEngagementLeadDrilldownResponse,
  type GrowthEngagementMediaDrilldownResponse,
  type GrowthEngagementSharePageDrilldownResponse,
  type GrowthEngagementTemplateDrilldownResponse,
  type GrowthEngagementTimelineEvent,
  type GrowthEngagementTimelineFilters,
  type GrowthEngagementTimelineResponse,
} from "@/lib/growth/engagement/growth-engagement-timeline-types"
import {
  filterEngagementTimelineEvents,
  GROWTH_ENGAGEMENT_TIMELINE_SAFETY_FLAGS,
  paginateEngagementTimelineEvents,
  parseEngagementTimelineFilters,
  summarizeLeadDrilldown,
} from "@/lib/growth/engagement/growth-engagement-timeline-utils"

export { parseEngagementTimelineFilters }

function buildTimelineResponse(
  filters: GrowthEngagementTimelineFilters,
  events: GrowthEngagementTimelineEvent[],
  sourceAvailability: Awaited<ReturnType<typeof probeGrowthEngagementTimelineSourceAvailability>>,
): GrowthEngagementTimelineResponse {
  const scoped = filterEngagementTimelineEvents(events, filters)
  const timeline = paginateEngagementTimelineEvents(scoped, {
    limit: filters.limit,
    cursor: filters.cursor,
  })

  return {
    qa_marker: GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER,
    filters,
    timeline,
    sourceAvailability,
    ...GROWTH_ENGAGEMENT_TIMELINE_SAFETY_FLAGS,
  }
}

export async function getGrowthEngagementTimeline(
  admin: SupabaseClient,
  filters: GrowthEngagementTimelineFilters,
): Promise<GrowthEngagementTimelineResponse> {
  const [sourceAvailability, loaded] = await Promise.all([
    probeGrowthEngagementTimelineSourceAvailability(admin),
    fetchEngagementTimelineEvents(admin, filters),
  ])

  return buildTimelineResponse(filters, loaded.events, sourceAvailability)
}

export async function getGrowthEngagementLeadDrilldown(
  admin: SupabaseClient,
  leadId: string,
  filters: GrowthEngagementTimelineFilters,
): Promise<GrowthEngagementLeadDrilldownResponse | null> {
  const scopedFilters = { ...filters, leadId }
  const [sourceAvailability, loaded] = await Promise.all([
    probeGrowthEngagementTimelineSourceAvailability(admin),
    fetchEngagementTimelineEvents(admin, scopedFilters),
  ])

  const scoped = filterEngagementTimelineEvents(loaded.events, scopedFilters)
  if (scoped.length === 0 && !sourceAvailability.share_pages.source_available) {
    return null
  }

  return {
    qa_marker: GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER,
    leadId,
    summary: summarizeLeadDrilldown(scoped, leadId),
    timeline: paginateEngagementTimelineEvents(scoped, { limit: filters.limit, cursor: filters.cursor }),
    sourceAvailability,
    ...GROWTH_ENGAGEMENT_TIMELINE_SAFETY_FLAGS,
  }
}

export async function getGrowthEngagementTemplateDrilldown(
  admin: SupabaseClient,
  templateId: string,
  filters: GrowthEngagementTimelineFilters,
): Promise<GrowthEngagementTemplateDrilldownResponse | null> {
  const meta = await fetchTemplateDrilldownMeta(admin, templateId, filters.organizationId)
  if (!meta) return null

  const scopedFilters = { ...filters, templateId }
  const [sourceAvailability, loaded] = await Promise.all([
    probeGrowthEngagementTimelineSourceAvailability(admin),
    fetchEngagementTimelineEvents(admin, scopedFilters),
  ])

  const scoped = filterEngagementTimelineEvents(loaded.events, scopedFilters)
  const summary = {
    templateId: meta.templateId,
    templateName: meta.templateName,
    pagesCreated: scoped.filter((event) => event.eventType === "template_instantiated").length,
    sharePageViews: scoped.filter((event) => event.eventType === "share_page_viewed").length,
    ctaClicks: scoped.filter((event) => event.eventType === "share_page_cta_clicked").length,
    bookingStarts: scoped.filter((event) => event.eventType === "share_page_booking_started").length,
    bookingCompletions: scoped.filter((event) => event.eventType === "share_page_booking_completed").length,
  }

  return {
    qa_marker: GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER,
    templateId,
    summary,
    timeline: paginateEngagementTimelineEvents(scoped, { limit: filters.limit, cursor: filters.cursor }),
    sourceAvailability,
    ...GROWTH_ENGAGEMENT_TIMELINE_SAFETY_FLAGS,
  }
}

export async function getGrowthEngagementMediaDrilldown(
  admin: SupabaseClient,
  mediaAssetId: string,
  filters: GrowthEngagementTimelineFilters,
): Promise<GrowthEngagementMediaDrilldownResponse | null> {
  const meta = await fetchMediaDrilldownMeta(admin, mediaAssetId, filters.organizationId)
  if (!meta) return null

  const scopedFilters = { ...filters, mediaAssetId }
  const [sourceAvailability, loaded] = await Promise.all([
    probeGrowthEngagementTimelineSourceAvailability(admin),
    fetchEngagementTimelineEvents(admin, scopedFilters),
  ])

  const scoped = filterEngagementTimelineEvents(loaded.events, scopedFilters)
  const playStarts = scoped.filter((event) => event.eventType === "media_play_started").length
  const completions = scoped.filter((event) => event.eventType === "media_completed").length

  return {
    qa_marker: GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER,
    mediaAssetId,
    summary: {
      mediaAssetId: meta.mediaAssetId,
      assetLabel: meta.assetLabel,
      views: scoped.filter((event) => event.eventType === "media_viewed").length,
      playStarts,
      completions,
      ctaClicks: scoped.filter((event) => event.eventType === "media_cta_clicked").length,
      averageWatchSeconds: 0,
      completionRate: playStarts > 0 ? completions / playStarts : 0,
    },
    timeline: paginateEngagementTimelineEvents(scoped, { limit: filters.limit, cursor: filters.cursor }),
    sourceAvailability,
    ...GROWTH_ENGAGEMENT_TIMELINE_SAFETY_FLAGS,
  }
}

export async function getGrowthEngagementSharePageDrilldown(
  admin: SupabaseClient,
  sharePageId: string,
  filters: GrowthEngagementTimelineFilters,
): Promise<GrowthEngagementSharePageDrilldownResponse | null> {
  const page = await fetchSharePageDrilldownMeta(admin, sharePageId, filters.organizationId)
  if (!page) return null

  const scopedFilters = { ...filters, sharePageId }
  const [sourceAvailability, loaded] = await Promise.all([
    probeGrowthEngagementTimelineSourceAvailability(admin),
    fetchEngagementTimelineEvents(admin, scopedFilters),
  ])

  const scoped = filterEngagementTimelineEvents(loaded.events, scopedFilters)

  return {
    qa_marker: GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER,
    sharePageId,
    summary: {
      sharePageId,
      leadId: page.leadId,
      templateId: page.sharePageTemplateId,
      status: page.status,
      viewCount: scoped.filter((event) => event.eventType === "share_page_viewed").length,
      ctaClicks: scoped.filter((event) => event.eventType === "share_page_cta_clicked").length,
      bookingStarts: scoped.filter((event) => event.eventType === "share_page_booking_started").length,
      bookingCompletions: scoped.filter((event) => event.eventType === "share_page_booking_completed").length,
      firstViewedAt: page.firstViewedAt,
      lastViewedAt: page.lastViewedAt,
    },
    timeline: paginateEngagementTimelineEvents(scoped, { limit: filters.limit, cursor: filters.cursor }),
    sourceAvailability,
    ...GROWTH_ENGAGEMENT_TIMELINE_SAFETY_FLAGS,
  }
}

export { GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER, GROWTH_ENGAGEMENT_TIMELINE_SAFETY_FLAGS }
