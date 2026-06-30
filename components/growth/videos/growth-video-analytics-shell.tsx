"use client"

import { useCallback, useEffect, useState } from "react"
import { StatTile } from "@/components/growth/growth-ui-utils"
import { GrowthEnginePanelResilience } from "@/components/growth/growth-engine-panel-resilience"
import { GrowthVideoWorkspaceShell } from "@/components/growth/videos/growth-video-workspace-shell"
import {
  GrowthVideoAnalyticsDistributionChart,
  GrowthVideoAnalyticsTopList,
  GrowthVideoAnalyticsViewsChart,
} from "@/components/growth/videos/growth-video-analytics-charts"
import type {
  GrowthVideoAnalyticsOverview,
  GrowthVideoAnalyticsTimeSeriesPoint,
  GrowthVideoAnalyticsTopItem,
} from "@/lib/growth/videos/growth-video-types"

type DashboardResponse = {
  ok?: boolean
  overview?: GrowthVideoAnalyticsOverview
  viewsOverTime?: GrowthVideoAnalyticsTimeSeriesPoint[]
  watchDistribution?: Array<{ label: string; count: number }>
  engagementScoreDistribution?: Array<{ label: string; count: number }>
  topVideos?: GrowthVideoAnalyticsTopItem[]
  topPages?: GrowthVideoAnalyticsTopItem[]
  message?: string
}

export function GrowthVideoAnalyticsShell() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<GrowthVideoAnalyticsOverview | null>(null)
  const [viewsOverTime, setViewsOverTime] = useState<GrowthVideoAnalyticsTimeSeriesPoint[]>([])
  const [watchDistribution, setWatchDistribution] = useState<Array<{ label: string; count: number }>>([])
  const [engagementScoreDistribution, setEngagementScoreDistribution] = useState<
    Array<{ label: string; count: number }>
  >([])
  const [topVideos, setTopVideos] = useState<GrowthVideoAnalyticsTopItem[]>([])
  const [topPages, setTopPages] = useState<GrowthVideoAnalyticsTopItem[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/growth/videos/analytics")
      const data = (await res.json().catch(() => ({}))) as DashboardResponse
      if (!res.ok || !data.ok || !data.overview) {
        throw new Error(data.message ?? "Could not load video analytics.")
      }
      setOverview(data.overview)
      setViewsOverTime(data.viewsOverTime ?? [])
      setWatchDistribution(data.watchDistribution ?? [])
      setEngagementScoreDistribution(data.engagementScoreDistribution ?? [])
      setTopVideos(data.topVideos ?? [])
      setTopPages(data.topPages ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <GrowthVideoWorkspaceShell
      title="Video Analytics"
      description="Engagement intelligence from personalized video pages — views, watch depth, CTAs, and intent signals."
    >
      <GrowthEnginePanelResilience loading={loading} error={error} onRetry={() => void load()}>
        {overview ? (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <StatTile label="Total views" value={overview.totalViews} hint="Page view events" />
              <StatTile label="Unique visitors" value={overview.uniqueVisitors} hint="Distinct sessions/visitors" />
              <StatTile
                label="Average watch %"
                value={
                  overview.averageWatchPercent != null ? `${overview.averageWatchPercent}%` : "No views yet"
                }
                hint="Highest percent watched per session"
              />
              <StatTile label="CTA clicks" value={overview.ctaClicks} />
              <StatTile label="Calendar clicks" value={overview.calendarClicks} />
              <StatTile label="Meetings booked" value="No bookings yet" hint="Connect calendar in Settings to track bookings" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-medium">Views over time</h3>
                <div className="mt-3">
                  <GrowthVideoAnalyticsViewsChart data={viewsOverTime} />
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-medium">Watch distribution</h3>
                <div className="mt-3">
                  <GrowthVideoAnalyticsDistributionChart data={watchDistribution} title="Watch distribution" />
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-medium">Engagement score distribution</h3>
                <div className="mt-3">
                  <GrowthVideoAnalyticsDistributionChart
                    data={engagementScoreDistribution}
                    title="Engagement scores"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <GrowthVideoAnalyticsTopList title="Top videos" items={topVideos} />
              <GrowthVideoAnalyticsTopList title="Top pages" items={topPages} />
            </div>
          </div>
        ) : null}
      </GrowthEnginePanelResilience>
    </GrowthVideoWorkspaceShell>
  )
}
