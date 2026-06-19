"use client"

import { useCallback, useEffect, useState } from "react"
import { StatTile } from "@/components/growth/growth-ui-utils"
import { GrowthEnginePanelResilience } from "@/components/growth/growth-engine-panel-resilience"
import { GrowthVideoAnalyticsDistributionChart } from "@/components/growth/videos/growth-video-analytics-charts"
import { GrowthVideoVisitorTimelinePanel } from "@/components/growth/videos/growth-video-visitor-timeline-panel"
import type {
  GrowthVideoAnalyticsOverview,
  GrowthVideoEngagementTimelineStep,
} from "@/lib/growth/videos/growth-video-types"

type PageAnalyticsResponse = {
  ok?: boolean
  overview?: GrowthVideoAnalyticsOverview
  watchDistribution?: Array<{ label: string; count: number }>
  engagementScoreDistribution?: Array<{ label: string; count: number }>
  timeline?: GrowthVideoEngagementTimelineStep[]
  message?: string
}

export function GrowthVideoPageAnalyticsSection({ pageId }: { pageId: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<GrowthVideoAnalyticsOverview | null>(null)
  const [watchDistribution, setWatchDistribution] = useState<Array<{ label: string; count: number }>>([])
  const [engagementScoreDistribution, setEngagementScoreDistribution] = useState<
    Array<{ label: string; count: number }>
  >([])
  const [timeline, setTimeline] = useState<GrowthVideoEngagementTimelineStep[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/growth/videos/analytics/pages/${encodeURIComponent(pageId)}`)
      const data = (await res.json().catch(() => ({}))) as PageAnalyticsResponse
      if (!res.ok || !data.ok || !data.overview) {
        throw new Error(data.message ?? "Could not load page analytics.")
      }
      setOverview(data.overview)
      setWatchDistribution(data.watchDistribution ?? [])
      setEngagementScoreDistribution(data.engagementScoreDistribution ?? [])
      setTimeline(data.timeline ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [pageId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-medium">Page analytics</h3>
      <GrowthEnginePanelResilience loading={loading} error={error} onRetry={() => void load()}>
        {overview ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <StatTile label="Views" value={overview.totalViews} />
              <StatTile label="Visitors" value={overview.uniqueVisitors} />
              <StatTile
                label="Watch %"
                value={overview.averageWatchPercent != null ? `${overview.averageWatchPercent}%` : "—"}
              />
              <StatTile label="CTA clicks" value={overview.ctaClicks} />
              <StatTile label="Calendar clicks" value={overview.calendarClicks} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <GrowthVideoAnalyticsDistributionChart data={watchDistribution} title="Watch distribution" />
              <GrowthVideoAnalyticsDistributionChart
                data={engagementScoreDistribution}
                title="Engagement scores"
              />
            </div>

            <GrowthVideoVisitorTimelinePanel items={timeline} />
          </div>
        ) : null}
      </GrowthEnginePanelResilience>
    </div>
  )
}
