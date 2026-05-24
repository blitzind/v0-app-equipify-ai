"use client"

import { ArrowDownRight, ArrowRight, ArrowUpRight, TrendingUp } from "lucide-react"
import { GrowthBadge, GrowthActionRequiredBadge, GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { growthLeadRevenueActionRequired } from "@/lib/growth/growth-lead-drawer-badges"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthRevenueForecastProps = {
  lead: GrowthLead
}

function trajectoryIcon(trajectory: GrowthLead["revenueTrajectory"]) {
  switch (trajectory) {
    case "accelerating":
      return <ArrowUpRight className="size-4 text-emerald-600" />
    case "slowing":
    case "at_risk":
      return <ArrowDownRight className="size-4 text-amber-600" />
    default:
      return <ArrowRight className="size-4 text-muted-foreground" />
  }
}

function trajectoryTone(trajectory: GrowthLead["revenueTrajectory"]): "healthy" | "warning" | "neutral" {
  if (trajectory === "accelerating") return "healthy"
  if (trajectory === "slowing" || trajectory === "at_risk") return "warning"
  return "neutral"
}

export function GrowthRevenueForecast({ lead }: GrowthRevenueForecastProps) {
  const collapsedSummary = [
    lead.revenueProbabilityScore != null ? `${lead.revenueProbabilityScore}` : null,
    lead.revenueProbabilityTier?.replace(/_/g, " ") ?? null,
    lead.revenueTrajectory ?? null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <GrowthCollapsibleEngineCard
      id="growth-revenue"
      title="Revenue Forecast"
      icon={<TrendingUp className="size-4" />}
      headerAside={collapsedSummary || "No forecast data"}
      headerTrailing={growthLeadRevenueActionRequired(lead) ? <GrowthActionRequiredBadge /> : null}
      defaultOpen
      persistKey={GROWTH_DRAWER_CARD_KEYS.revenue}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-foreground">
            {lead.revenueProbabilityScore ?? "—"}
          </span>
          {lead.revenueProbabilityTier ? (
            <GrowthBadge label={lead.revenueProbabilityTier.replace(/_/g, " ")} tone="healthy" />
          ) : null}
          {lead.revenueTrajectory ? (
            <span className="inline-flex items-center gap-1">
              {trajectoryIcon(lead.revenueTrajectory)}
              <GrowthBadge label={lead.revenueTrajectory.replace(/_/g, " ")} tone={trajectoryTone(lead.revenueTrajectory)} />
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <span className="text-muted-foreground">
            Confidence:{" "}
            <span className="font-medium text-foreground">{lead.revenueProbabilityConfidence}</span>
          </span>
          <span className="text-muted-foreground">
            Volatility:{" "}
            <span className="font-medium text-foreground">{lead.revenueProbabilityVolatility}</span>
          </span>
          <span className="text-muted-foreground">
            Attention:{" "}
            <span className="font-medium text-foreground">{lead.forecastAttentionLevel.replace(/_/g, " ")}</span>
          </span>
          <span className="text-muted-foreground">
            Contribution:{" "}
            <span className="font-medium text-foreground">{lead.forecastContributionWeight}</span>
          </span>
        </div>

        {lead.forecastAttentionLastChangedAt ? (
          <p className="text-xs text-muted-foreground">
            Attention last changed {new Date(lead.forecastAttentionLastChangedAt).toLocaleString()}
          </p>
        ) : null}

        {lead.revenueProbabilitySummary ? (
          <p className="text-sm text-foreground">{lead.revenueProbabilitySummary}</p>
        ) : null}

        {lead.revenueProbabilityTopSignals.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Top signals</p>
            <ul className="space-y-1.5">
              {lead.revenueProbabilityTopSignals.map((signal, index) => (
                <li key={`${signal.kind}-${index}`} className="flex justify-between gap-3 text-sm">
                  <span>{signal.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {signal.points > 0 ? "+" : ""}
                    {signal.points}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </GrowthCollapsibleEngineCard>
  )
}
