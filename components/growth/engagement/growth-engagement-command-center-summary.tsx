"use client"

import { GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { GrowthEngagementMediaTable } from "@/components/growth/engagement/growth-engagement-media-table"
import { GrowthEngagementSummaryCards } from "@/components/growth/engagement/growth-engagement-summary-cards"
import { GrowthEngagementTemplateTable } from "@/components/growth/engagement/growth-engagement-template-table"
import type { GrowthEngagementCommandCenterOverviewSection } from "@/lib/growth/engagement/growth-engagement-command-center-types"
import type { GrowthEngagementDrilldownTarget } from "@/components/growth/engagement/growth-engagement-drilldown-drawer"

export function GrowthEngagementCommandCenterSummary({
  overview,
  onOpenDrilldown,
}: {
  overview: GrowthEngagementCommandCenterOverviewSection | null
  onOpenDrilldown?: (target: GrowthEngagementDrilldownTarget) => void
}) {
  if (!overview) {
    return (
      <GrowthEngineCard title="Engagement summary">
        <p className="text-sm text-muted-foreground">Loading summary…</p>
      </GrowthEngineCard>
    )
  }

  return (
    <div className="space-y-4">
      <GrowthEngagementSummaryCards overview={overview.overview} />

      <div className="grid gap-3 md:grid-cols-3">
        <StatTile label="Share page CTAs" value={overview.ctaPerformance.sharePageCtaClicks} />
        <StatTile label="Media CTAs" value={overview.ctaPerformance.mediaCtaClicks} />
        <StatTile label="Total CTAs" value={overview.ctaPerformance.totalCtaClicks} />
      </div>

      <GrowthEngineCard title="Booking handoff readiness">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatTile label="Templates w/ handoff" value={overview.bookingHandoffReadiness.templatesWithHandoffEnabled} />
          <StatTile label="Share page booking starts" value={overview.bookingHandoffReadiness.sharePageBookingStarts} />
          <StatTile label="Share page booking done" value={overview.bookingHandoffReadiness.sharePageBookingCompletions} />
          <StatTile label="Ready tier" value={overview.bookingHandoffReadiness.readyTierCount} />
          <StatTile label="High-intent tier" value={overview.bookingHandoffReadiness.highIntentTierCount} />
        </div>
      </GrowthEngineCard>

      <GrowthEngagementTemplateTable
        items={overview.topTemplates}
        onOpenTemplate={(id) => onOpenDrilldown?.({ kind: "template", id })}
      />
      <GrowthEngagementMediaTable
        items={overview.topAssets}
        onOpenAsset={(id) => onOpenDrilldown?.({ kind: "media", id })}
      />
    </div>
  )
}
