import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { loadGrowthActivityLeadTimelineForOrg } from "@/lib/growth/activity/growth-activity-read-repository"
import {
  mapEngagementTimelineEventToEventView,
  mapLeadTimelineRowToEventView,
  mapPersonalizationGenerationToEventViews,
  mapSendrActivityFeedRows,
  mapSendrHotProspectToRailCard,
  mapSignalFeedItemToEventView,
  mapSignalFeedItemToRailCard,
} from "@/lib/growth/activity/growth-activity-source-adapters"
import {
  buildGrowthActivityRailQueues,
  buildGrowthActivitySourceAudit,
  mergeGrowthActivityEvents,
} from "@/lib/growth/activity/growth-activity-unified-feed"
import { GROWTH_ACTIVITY_UNIFIED_FEED_QA_MARKER } from "@/lib/growth/activity/growth-activity-workspace-constants"
import type {
  GrowthActivityEventView,
  GrowthActivityRailQueues,
  GrowthActivitySourceAuditEntry,
} from "@/lib/growth/activity/growth-activity-workspace-types"
import { getGrowthEngagementTimeline } from "@/lib/growth/engagement/growth-engagement-timeline-service"
import { listPersonalizationGenerations } from "@/lib/growth/personalization/dashboard"
import { loadGrowthSignalFeed } from "@/lib/growth/signal-intelligence/signal-feed-repository"
import { resolveSendrAnalyticsDateRange } from "@/lib/growth/sendr/growth-sendr-analytics-date-range"
import { buildSendrActivityFeedRows } from "@/lib/growth/sendr/growth-sendr-activity-feed-service"
import { getSendrHotProspects } from "@/lib/growth/sendr/growth-sendr-activity-prospects-service"

export type GrowthActivityUnifiedFeedPayload = {
  qa_marker: typeof GROWTH_ACTIVITY_UNIFIED_FEED_QA_MARKER
  events: GrowthActivityEventView[]
  railQueues: GrowthActivityRailQueues
  sourceAudit: GrowthActivitySourceAuditEntry[]
  dateRange: { preset: string; startAt: string; endAt: string }
}

export async function getGrowthActivityUnifiedFeed(
  admin: SupabaseClient,
  input: {
    organizationId: string
    dateRangePreset?: string | null
    limit?: number
  },
): Promise<GrowthActivityUnifiedFeedPayload> {
  const dateRange = resolveSendrAnalyticsDateRange({ preset: input.dateRangePreset })
  const limit = Math.min(input.limit ?? 200, 500)

  const [
    sendrResult,
    engagementResult,
    signalsResult,
    timelineResult,
    personalizationResult,
    prospectsResult,
  ] = await Promise.allSettled([
    buildSendrActivityFeedRows(admin, { organizationId: input.organizationId, dateRange, limit }),
    getGrowthEngagementTimeline(admin, {
      organizationId: input.organizationId,
      dateRange: dateRange.preset,
      startDate: dateRange.startAt,
      endDate: dateRange.endAt,
      limit: Math.min(limit, 100),
    }),
    loadGrowthSignalFeed(admin, { limit: Math.min(limit, 80), sort: "occurred_at" }),
    loadGrowthActivityLeadTimelineForOrg(admin, {
      organizationId: input.organizationId,
      startAt: dateRange.startAt,
      endAt: dateRange.endAt,
      limit: Math.min(limit, 150),
    }),
    listPersonalizationGenerations(admin, { limit: Math.min(limit, 40) }),
    getSendrHotProspects(admin, {
      organizationId: input.organizationId,
      dateRange,
      sort: "intent",
      pageSize: 30,
    }),
  ])

  const sendrRows = sendrResult.status === "fulfilled" ? sendrResult.value : []
  const engagementItems =
    engagementResult.status === "fulfilled" ? engagementResult.value.timeline.items : []
  const signalItems = signalsResult.status === "fulfilled" ? signalsResult.value.items : []
  const timelineRows = timelineResult.status === "fulfilled" ? timelineResult.value : []
  const generations = personalizationResult.status === "fulfilled" ? personalizationResult.value : []
  const hotProspects = prospectsResult.status === "fulfilled" ? prospectsResult.value.items : []

  const sendrEvents = mapSendrActivityFeedRows(sendrRows)
  const engagementEvents = engagementItems.map(mapEngagementTimelineEventToEventView)
  const signalEvents = signalItems.map(mapSignalFeedItemToEventView)
  const timelineEvents = timelineRows.map(mapLeadTimelineRowToEventView)
  const personalizationEvents = generations.flatMap(mapPersonalizationGenerationToEventViews)

  const events = mergeGrowthActivityEvents(
    sendrEvents,
    engagementEvents,
    signalEvents,
    timelineEvents,
    personalizationEvents,
  ).slice(0, limit)

  const sendrRail = hotProspects.map((prospect) => mapSendrHotProspectToRailCard(prospect))
  const signalRail = (signalsResult.status === "fulfilled" ? signalsResult.value.hot_signals : [])
    .slice(0, 10)
    .map((item) => mapSignalFeedItemToRailCard(item, "hot-prospects"))

  const railQueues = buildGrowthActivityRailQueues({
    sendrProspects: sendrRail,
    signalHot: signalRail,
    events,
  })

  const sourceAudit = buildGrowthActivitySourceAudit({
    sendr: sendrEvents.length,
    engagement: engagementEvents.length,
    signals: signalEvents.length,
    timeline: timelineEvents.length,
    personalization: personalizationEvents.length,
    sendrAvailable: sendrResult.status === "fulfilled",
    engagementAvailable: engagementResult.status === "fulfilled",
    signalsAvailable: signalsResult.status === "fulfilled",
    timelineAvailable: timelineResult.status === "fulfilled",
    personalizationAvailable: personalizationResult.status === "fulfilled",
  })

  return {
    qa_marker: GROWTH_ACTIVITY_UNIFIED_FEED_QA_MARKER,
    events,
    railQueues,
    sourceAudit,
    dateRange: {
      preset: dateRange.preset,
      startAt: dateRange.startAt,
      endAt: dateRange.endAt,
    },
  }
}
