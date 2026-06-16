"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { StatTile } from "@/components/growth/growth-ui-utils"
import { GrowthEngagementTimelineItem } from "@/components/growth/engagement/growth-engagement-timeline-item"
import type { GrowthEngagementDashboardDateRangePreset } from "@/lib/growth/engagement/growth-engagement-dashboard-types"
import type { GrowthEngagementTemplateDrilldownResponse } from "@/lib/growth/engagement/growth-engagement-timeline-types"

type DrilldownResponse = {
  ok?: boolean
  drilldown?: GrowthEngagementTemplateDrilldownResponse
  message?: string
}

export function GrowthEngagementTemplateDrilldown({
  templateId,
  dateRange,
}: {
  templateId: string
  dateRange: GrowthEngagementDashboardDateRangePreset
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drilldown, setDrilldown] = useState<GrowthEngagementTemplateDrilldownResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/engagement-dashboard/templates/${encodeURIComponent(templateId)}?dateRange=${dateRange}&limit=50`,
        { cache: "no-store" },
      )
      const data = (await res.json().catch(() => ({}))) as DrilldownResponse
      if (!res.ok || !data.ok || !data.drilldown) {
        throw new Error(data.message ?? "Could not load template drilldown.")
      }
      setDrilldown(data.drilldown)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load template drilldown.")
    } finally {
      setLoading(false)
    }
  }, [templateId, dateRange])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading template drilldown…
      </div>
    )
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!drilldown) return <p className="text-sm text-muted-foreground">No template drilldown data.</p>

  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium">{drilldown.summary.templateName}</p>
        <p className="text-xs text-muted-foreground">{drilldown.summary.templateId}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile label="Pages created" value={drilldown.summary.pagesCreated} />
        <StatTile label="Views" value={drilldown.summary.sharePageViews} />
        <StatTile label="CTA clicks" value={drilldown.summary.ctaClicks} />
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
