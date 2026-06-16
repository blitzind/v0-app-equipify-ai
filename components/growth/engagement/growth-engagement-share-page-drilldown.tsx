"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { StatTile } from "@/components/growth/growth-ui-utils"
import { GrowthEngagementTimelineItem } from "@/components/growth/engagement/growth-engagement-timeline-item"
import type { GrowthEngagementDashboardDateRangePreset } from "@/lib/growth/engagement/growth-engagement-dashboard-types"
import type { GrowthEngagementSharePageDrilldownResponse } from "@/lib/growth/engagement/growth-engagement-timeline-types"

type DrilldownResponse = {
  ok?: boolean
  drilldown?: GrowthEngagementSharePageDrilldownResponse
  message?: string
}

export function GrowthEngagementSharePageDrilldown({
  sharePageId,
  dateRange,
}: {
  sharePageId: string
  dateRange: GrowthEngagementDashboardDateRangePreset
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drilldown, setDrilldown] = useState<GrowthEngagementSharePageDrilldownResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/engagement-dashboard/share-pages/${encodeURIComponent(sharePageId)}?dateRange=${dateRange}&limit=50`,
        { cache: "no-store" },
      )
      const data = (await res.json().catch(() => ({}))) as DrilldownResponse
      if (!res.ok || !data.ok || !data.drilldown) {
        throw new Error(data.message ?? "Could not load share page drilldown.")
      }
      setDrilldown(data.drilldown)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load share page drilldown.")
    } finally {
      setLoading(false)
    }
  }, [sharePageId, dateRange])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading share page drilldown…
      </div>
    )
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!drilldown) return <p className="text-sm text-muted-foreground">No share page drilldown data.</p>

  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium">Share page {drilldown.summary.sharePageId.slice(0, 8)}…</p>
        <p className="text-xs text-muted-foreground">Status: {drilldown.summary.status ?? "unknown"}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile label="Views" value={drilldown.summary.viewCount} />
        <StatTile label="CTA clicks" value={drilldown.summary.ctaClicks} />
        <StatTile label="Booking starts" value={drilldown.summary.bookingStarts} />
        <StatTile label="Booking done" value={drilldown.summary.bookingCompletions} />
      </div>
      <ul className="space-y-2">
        {drilldown.timeline.items.map((event) => (
          <li key={event.eventId}>
            <GrowthEngagementTimelineItem event={event} />
          </li>
        ))}
      </ul>
    </div>
  )
}
