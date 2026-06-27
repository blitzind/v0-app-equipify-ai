"use client"

import type { GrowthAiOsOperatorBusinessMetric } from "@/lib/growth/aios/operator-experience/growth-ai-os-operator-experience-types"

export function GrowthAiOsBusinessSnapshotSection({ metrics }: { metrics: GrowthAiOsOperatorBusinessMetric[] }) {
  return (
    <section data-qa-section="operator-business-snapshot" className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Business Snapshot</h2>
        <p className="mt-1 text-muted-foreground">Pipeline and revenue signals — not engineering metrics.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.id} className="rounded-xl border border-border/70 bg-card px-5 py-4">
            <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{metric.value}</p>
            {metric.trendLabel ? (
              <p className="mt-1 text-sm text-muted-foreground">{metric.trendLabel}</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}
