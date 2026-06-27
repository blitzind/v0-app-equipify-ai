"use client"

import type { GrowthHomeRevenueForecast } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_REVENUE_FORECAST_TITLE } from "@/lib/workspace/ai-autonomous-revenue-operator"
import { GrowthHomeProgressBar } from "@/components/growth/workspace/executive-briefing/growth-home-progress-bar"

type Props = {
  forecast: GrowthHomeRevenueForecast | null
}

export function GrowthHomeRevenueForecastSection({ forecast }: Props) {
  if (!forecast) return null

  return (
    <section data-qa-section="home-revenue-forecast" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_REVENUE_FORECAST_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Projected attainment from Revenue Director read models.</p>
      </div>
      <article className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <p className="text-muted-foreground">Current monthly goal</p>
            <p className="text-lg font-semibold">{forecast.monthlyGoal}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Projected attainment</p>
            <p className="text-lg font-semibold">{forecast.projectedAttainment}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Remaining work</p>
            <p className="text-lg font-semibold">{forecast.remainingWork}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Confidence</p>
            <p className="text-lg font-semibold">{forecast.confidence}</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Goal progress</span>
            <span className="font-medium">{forecast.projectedPercent}%</span>
          </div>
          <GrowthHomeProgressBar percent={forecast.projectedPercent} />
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Risk · </span>
          {forecast.risk}
        </p>
      </article>
    </section>
  )
}
