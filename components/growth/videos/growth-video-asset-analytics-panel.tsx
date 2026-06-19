"use client"

import { useCallback, useEffect, useState } from "react"
import { StatTile } from "@/components/growth/growth-ui-utils"
import { GrowthEnginePanelResilience } from "@/components/growth/growth-engine-panel-resilience"
import {
  GrowthVideoAnalyticsDistributionChart,
} from "@/components/growth/videos/growth-video-analytics-charts"
import { GrowthVideoVisitorTimelinePanel } from "@/components/growth/videos/growth-video-visitor-timeline-panel"
import type {
  GrowthVideoAnalyticsOverview,
  GrowthVideoEngagementTimelineStep,
} from "@/lib/growth/videos/growth-video-types"

type AssetAnalyticsResponse = {
  ok?: boolean
  overview?: GrowthVideoAnalyticsOverview
  watchDistribution?: Array<{ label: string; count: number }>
  engagementScoreDistribution?: Array<{ label: string; count: number }>
  timeline?: GrowthVideoEngagementTimelineStep[]
  message?: string
}

export function GrowthVideoAssetAnalyticsPanel({ assetId }: { assetId: string }) {
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
      const res = await fetch(`/api/growth/videos/analytics/assets/${encodeURIComponent(assetId)}`)
      const data = (await res.json().catch(() => ({}))) as AssetAnalyticsResponse
      if (!res.ok || !data.ok || !data.overview) {
        throw new Error(data.message ?? "Could not load asset analytics.")
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
  }, [assetId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <GrowthEnginePanelResilience loading={loading} error={error} onRetry={() => void load()}>
      {overview ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Total views" value={overview.totalViews} />
            <StatTile label="Unique visitors" value={overview.uniqueVisitors} />
            <StatTile
              label="Average watch %"
              value={overview.averageWatchPercent != null ? `${overview.averageWatchPercent}%` : "—"}
            />
            <StatTile label="CTA clicks" value={overview.ctaClicks} />
            <StatTile label="Calendar clicks" value={overview.calendarClicks} />
            <StatTile
              label="Avg engagement score"
              value={overview.averageEngagementScore ?? "—"}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
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

          <GrowthVideoVisitorTimelinePanel items={timeline} />
        </div>
      ) : null}
    </GrowthEnginePanelResilience>
  )
}
