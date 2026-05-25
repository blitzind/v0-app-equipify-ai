"use client"

import type { GrowthResearchCoverageSummary } from "@/lib/growth/research/research-types"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"

export function GrowthCommandResearchCoverageSection({
  coverage,
}: {
  coverage: GrowthResearchCoverageSummary
}) {
  return (
    <GrowthEngineCard title="Research Coverage" subtitle="Prospect intelligence across the pipeline">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Research complete" value={`${coverage.researchCompletePercent}%`} />
        <StatTile label="Unresearched leads" value={String(coverage.unresearchedLeads)} />
        <StatTile label="Weak website opportunities" value={String(coverage.weakWebsiteOpportunities)} />
        <StatTile label="Total leads" value={String(coverage.totalLeads)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top pain signals</p>
          <div className="flex flex-wrap gap-1.5">
            {coverage.topPainSignals.length > 0 ? (
              coverage.topPainSignals.map((entry) => (
                <GrowthBadge key={entry.signal} tone="attention">
                  {entry.signal.replace(/_/g, " ")} · {entry.count}
                </GrowthBadge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">No completed research runs yet</span>
            )}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top industries</p>
          <div className="flex flex-wrap gap-1.5">
            {coverage.topIndustries.length > 0 ? (
              coverage.topIndustries.map((entry) => (
                <GrowthBadge key={entry.industry} tone="neutral">
                  {entry.industry} · {entry.count}
                </GrowthBadge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">No industry classifications yet</span>
            )}
          </div>
        </div>
      </div>
    </GrowthEngineCard>
  )
}
