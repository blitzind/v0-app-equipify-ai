"use client"

import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthCommandMarketHealth } from "@/lib/growth/market-intelligence/market-intelligence-types"
import { GROWTH_MARKET_INTELLIGENCE_QA_MARKER } from "@/lib/growth/market-intelligence/market-intelligence-types"

export function GrowthCommandMarketOperatingSection({
  marketHealth,
}: {
  marketHealth: GrowthCommandMarketHealth
}) {
  return (
    <GrowthEngineCard title="Market Operating System">
      <p className="mb-3 text-xs text-muted-foreground">
        Continuous discovery, coverage, and confidence · {GROWTH_MARKET_INTELLIGENCE_QA_MARKER}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Market coverage" value={`${marketHealth.coverage_percent}%`} />
        <StatTile label="Whitespace" value={`${marketHealth.whitespace_percent}%`} />
        <StatTile label="Discovery velocity" value={String(marketHealth.discovery_velocity)} />
        <StatTile label="New companies discovered" value={String(marketHealth.new_companies_discovered)} />
        <StatTile label="High-fit discovered" value={String(marketHealth.high_fit_discovered)} />
        <StatTile label="Signal velocity" value={`${marketHealth.signal_velocity}%`} />
        <StatTile label="Market penetration" value={`${marketHealth.market_penetration}%`} />
        <StatTile label="Committee completion avg" value={`${marketHealth.committee_completion_avg}%`} />
        <StatTile
          label="Related company opportunities"
          value={String(marketHealth.related_company_opportunities)}
        />
        <StatTile label="Prospect saturation" value={`${marketHealth.prospect_saturation}%`} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <GrowthBadge tone="neutral" label="Evidence-backed only" />
        <GrowthBadge tone="neutral" label="Deterministic scoring" />
        <GrowthBadge tone="neutral" label="No autonomous outreach" />
      </div>
    </GrowthEngineCard>
  )
}
