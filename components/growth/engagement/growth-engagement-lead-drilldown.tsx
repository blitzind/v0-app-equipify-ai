"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { StatTile } from "@/components/growth/growth-ui-utils"
import { GrowthEngagementTimelineItem } from "@/components/growth/engagement/growth-engagement-timeline-item"
import type { GrowthEngagementDashboardDateRangePreset } from "@/lib/growth/engagement/growth-engagement-dashboard-types"
import type { GrowthEngagementLeadDrilldownResponse } from "@/lib/growth/engagement/growth-engagement-timeline-types"

type DrilldownResponse = {
  ok?: boolean
  drilldown?: GrowthEngagementLeadDrilldownResponse
  message?: string
}

export function GrowthEngagementLeadDrilldown({
  leadId,
  dateRange,
}: {
  leadId: string
  dateRange: GrowthEngagementDashboardDateRangePreset
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drilldown, setDrilldown] = useState<GrowthEngagementLeadDrilldownResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/engagement-dashboard/lead/${encodeURIComponent(leadId)}?dateRange=${dateRange}&limit=50`,
        { cache: "no-store" },
      )
      const data = (await res.json().catch(() => ({}))) as DrilldownResponse
      if (!res.ok || !data.ok || !data.drilldown) {
        throw new Error(data.message ?? "Could not load lead drilldown.")
      }
      setDrilldown(data.drilldown)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load lead drilldown.")
    } finally {
      setLoading(false)
    }
  }, [leadId, dateRange])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading lead drilldown…
      </div>
    )
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!drilldown) return <p className="text-sm text-muted-foreground">No lead drilldown data.</p>

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile label="Share page views" value={drilldown.summary.sharePageViews} />
        <StatTile label="CTA clicks" value={drilldown.summary.ctaClicks} />
        <StatTile label="Booking starts" value={drilldown.summary.bookingStarts} />
        <StatTile label="High-intent signals" value={drilldown.summary.highIntentSignals} />
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
