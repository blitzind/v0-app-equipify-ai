"use client"

import { StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthEngagementDashboardOverviewMetrics } from "@/lib/growth/engagement/growth-engagement-dashboard-types"

function formatRate(value: number): string {
  return `${Math.round(value * 100)}%`
}

function formatSeconds(value: number): string {
  if (value <= 0) return "0s"
  if (value < 60) return `${Math.round(value)}s`
  return `${(value / 60).toFixed(1)}m`
}

export function GrowthEngagementSummaryCards({
  overview,
}: {
  overview: GrowthEngagementDashboardOverviewMetrics | null
}) {
  if (!overview) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        No engagement metrics available for the selected filters.
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile label="Share page views" value={overview.totalSharePageViews} hint="Total viewed events" />
      <StatTile label="Unique visitors" value={overview.uniqueSharePageVisitors} hint="Distinct sessions" />
      <StatTile label="CTA clicks" value={overview.ctaClicks} hint="Share page CTA events" />
      <StatTile label="Booking starts" value={overview.bookingStarts} hint="Share page booking flow" />
      <StatTile label="Booking completions" value={overview.bookingCompletions} hint="Completed bookings" />
      <StatTile label="Media views" value={overview.mediaViews} hint="Video viewed events" />
      <StatTile label="Play starts" value={overview.mediaPlayStarts} hint="Playback starts" />
      <StatTile label="Media completions" value={overview.mediaCompletions} hint="Video completed events" />
      <StatTile label="Media CTA clicks" value={overview.mediaCtaClicks} hint="In-player CTAs" />
      <StatTile label="Avg watch time" value={formatSeconds(overview.averageWatchSeconds)} hint="Weighted by plays" />
      <StatTile label="Completion rate" value={formatRate(overview.completionRate)} hint="Completions / play starts" />
      <StatTile label="Templates in use" value={overview.templateUsageCount} hint="Distinct templates" />
    </div>
  )
}
