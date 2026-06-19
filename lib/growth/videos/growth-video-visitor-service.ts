import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_VIDEO_ANALYTICS_QA_MARKER,
  GROWTH_VIDEO_AI_ENGAGEMENT_SIGNALS,
  type GrowthVideoAiEngagementSignal,
  type GrowthVideoVisitorProfile,
} from "@/lib/growth/videos/growth-video-types"
import {
  createGrowthVideoAnalyticsSummaryService,
  type GrowthVideoAnalyticsFilters,
} from "@/lib/growth/videos/growth-video-analytics-summary-service"
import { createGrowthVideoEngagementTimelineService } from "@/lib/growth/videos/growth-video-engagement-timeline-service"

export class GrowthVideoVisitorService {
  constructor(private readonly admin: SupabaseClient) {}

  async getVisitorProfile(input: {
    organizationId: string
    visitorIdentifier: string
  }): Promise<{ ok: true; profile: GrowthVideoVisitorProfile; sessionIds: string[] } | { ok: false; error: string }> {
    const visitorIdentifier = input.visitorIdentifier.trim()
    if (!visitorIdentifier) return { ok: false, error: "invalid_visitor" }

    const summaryService = createGrowthVideoAnalyticsSummaryService(this.admin)
    const filters: GrowthVideoAnalyticsFilters = {
      organizationId: input.organizationId,
      visitorIdentifier,
    }

    const summaries = await summaryService.listSummaries(filters)
    if (!summaries.length) {
      return {
        ok: true,
        profile: {
          visitorIdentifier,
          sessionCount: 0,
          totalViews: 0,
          highestEngagementScore: 0,
          lastViewedAt: null,
          aiSignals: Object.fromEntries(
            GROWTH_VIDEO_AI_ENGAGEMENT_SIGNALS.map((signal) => [signal, false]),
          ) as Record<GrowthVideoAiEngagementSignal, boolean>,
        },
        sessionIds: [],
      }
    }

    const sessionIds = [...new Set(summaries.map((row) => row.sessionId))]
    const totalViews = summaries.reduce((sum, row) => sum + row.totalViews, 0)
    const highestEngagementScore = Math.max(...summaries.map((row) => row.engagementScore))
    const lastViewedAt =
      summaries
        .map((row) => row.lastViewedAt)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null

    const aiSignals = Object.fromEntries(
      GROWTH_VIDEO_AI_ENGAGEMENT_SIGNALS.map((signal) => [signal, false]),
    ) as Record<GrowthVideoAiEngagementSignal, boolean>

    for (const summary of summaries) {
      const signals = summary.metadata.ai_signals as Record<string, boolean> | undefined
      if (!signals) continue
      for (const signal of GROWTH_VIDEO_AI_ENGAGEMENT_SIGNALS) {
        if (signals[signal]) aiSignals[signal] = true
      }
    }
    if (sessionIds.length > 1) aiSignals.video_return_visitor = true

    return {
      ok: true,
      profile: {
        visitorIdentifier,
        sessionCount: sessionIds.length,
        totalViews,
        highestEngagementScore,
        lastViewedAt,
        aiSignals,
      },
      sessionIds,
    }
  }

  async getVisitorTimeline(input: {
    organizationId: string
    visitorIdentifier: string
    limit?: number
  }) {
    const timelineService = createGrowthVideoEngagementTimelineService(this.admin)
    return timelineService.listTimeline({
      organizationId: input.organizationId,
      visitorIdentifier: input.visitorIdentifier,
      limit: input.limit,
    })
  }
}

export function createGrowthVideoVisitorService(admin: SupabaseClient): GrowthVideoVisitorService {
  return new GrowthVideoVisitorService(admin)
}

export function growthVideoVisitorSafetyPayload() {
  return {
    qa_marker: GROWTH_VIDEO_ANALYTICS_QA_MARKER,
    read_only: true,
    no_automation_triggers: true,
    no_sequence_triggers: true,
  }
}
