"use client"

import Link from "next/link"
import { useMemo } from "react"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { buildGrowthCampaignsHubRecommendations } from "@/lib/growth/hubs/growth-campaigns-hub-recommendations"
import { useGrowthCampaignsHubMetrics } from "@/components/growth/hubs/campaigns/use-growth-campaigns-hub-metrics"
import { cn } from "@/lib/utils"

const SEVERITY_STYLES = {
  HIGH: "border-red-200/80 bg-red-50/30",
  MEDIUM: "border-amber-200/80 bg-amber-50/30",
  LOW: "border-border/80 bg-background",
} as const

export function GrowthCampaignsHubRecommendations() {
  const { metrics } = useGrowthCampaignsHubMetrics()
  const recommendations = useMemo(() => buildGrowthCampaignsHubRecommendations(metrics), [metrics])

  return (
    <section aria-labelledby="campaigns-hub-recommendations-heading" data-section="recommended-actions">
      <GrowthEngineCard title="Recommended Actions">
        <h2 id="campaigns-hub-recommendations-heading" className="sr-only">
          Recommended actions
        </h2>
        <ul className="divide-y divide-border/70 rounded-xl border border-border/80">
          {recommendations.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col gap-1 border-l-4 px-4 py-3 text-sm transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between",
                  SEVERITY_STYLES[item.severity],
                )}
              >
                <div>
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.severity}</span>
              </Link>
            </li>
          ))}
        </ul>
      </GrowthEngineCard>
    </section>
  )
}
