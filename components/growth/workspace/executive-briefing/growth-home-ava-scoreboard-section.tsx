"use client"

import type { GrowthHomeAvaBusinessScoreboardMetric } from "@/lib/growth/ava-home/recommendations/growth-home-ava-business-objective-next-1e-types"

type Props = {
  metrics: GrowthHomeAvaBusinessScoreboardMetric[]
}

export function GrowthHomeAvaScoreboardSection({ metrics }: Props) {
  if (metrics.length === 0) return null

  return (
    <section data-qa-section="home-ava-business-scoreboard" className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Business scoreboard</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <div
            key={metric.id}
            className="rounded-lg border border-border/50 bg-card/70 px-3 py-2"
            data-qa-field={`scoreboard-${metric.id}`}
          >
            <p className="text-xs text-muted-foreground">{metric.label}</p>
            <p className="text-sm font-medium text-foreground">{metric.valueLabel}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
