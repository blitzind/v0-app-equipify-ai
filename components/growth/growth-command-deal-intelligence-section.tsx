"use client"

import type { DealIntelligenceDashboardSummary } from "@/lib/growth/deal-intelligence/deal-intelligence-types"
import { DEAL_OPERATOR_ACTION_LABELS } from "@/lib/growth/deal-intelligence/deal-intelligence-types"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"

export function GrowthCommandDealIntelligenceSection({
  summary,
}: {
  summary: DealIntelligenceDashboardSummary
}) {
  return (
    <GrowthEngineCard
      title="Predictive Deal Intelligence"
      subtitle="Deterministic deal scores — suggestions only, no autonomous CRM movement"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="High-probability deals" value={String(summary.highProbabilityDeals)} />
        <StatTile label="Critical-risk deals" value={String(summary.criticalRiskDeals)} />
        <StatTile label="Avg forecast confidence" value={`${summary.averageForecastConfidence}%`} />
        <StatTile label="Deals needing action" value={String(summary.dealsNeedingAction)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Top recommended actions
          </p>
          <div className="flex flex-wrap gap-1.5">
            {summary.topRecommendedActions.length > 0 ? (
              summary.topRecommendedActions.map((entry) => (
                <GrowthBadge key={entry.action} tone="neutral">
                  {DEAL_OPERATOR_ACTION_LABELS[entry.action]} · {entry.count}
                </GrowthBadge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">No scored opportunities yet</span>
            )}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Coverage</p>
          <div className="flex flex-wrap gap-1.5">
            <GrowthBadge tone="healthy">{summary.scoredOpportunities} scored opportunities</GrowthBadge>
            <GrowthBadge tone="neutral">Avg close {summary.averageCloseProbability}%</GrowthBadge>
          </div>
        </div>
      </div>
    </GrowthEngineCard>
  )
}
