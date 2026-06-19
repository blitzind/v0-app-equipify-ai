"use client"

import { Loader2 } from "lucide-react"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GROWTH_CAMPAIGNS_HUB_PERFORMANCE_METRICS } from "@/lib/growth/hubs/growth-campaigns-hub-config"
import { useGrowthCampaignsHubMetrics } from "@/components/growth/hubs/campaigns/use-growth-campaigns-hub-metrics"

export function GrowthCampaignsHubPerformance() {
  const { loading, metrics } = useGrowthCampaignsHubMetrics()

  return (
    <section aria-labelledby="campaigns-hub-performance-heading" data-section="campaign-performance">
      <GrowthEngineCard title="Campaign Performance">
        <h2 id="campaigns-hub-performance-heading" className="sr-only">
          Campaign performance
        </h2>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading performance…
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {GROWTH_CAMPAIGNS_HUB_PERFORMANCE_METRICS.map((metric) => {
              const raw = metrics[metric.metricKey]
              const value =
                metric.metricKey === "openRate" || metric.metricKey === "replyRate"
                  ? `${raw}${metric.suffix ?? ""}`
                  : Number(raw).toLocaleString()
              return (
                <div
                  key={metric.id}
                  className="rounded-xl border border-border/80 bg-background px-4 py-3"
                  data-metric={metric.id}
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{metric.label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
                </div>
              )
            })}
          </div>
        )}
      </GrowthEngineCard>
    </section>
  )
}
