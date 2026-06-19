"use client"

import Link from "next/link"
import { Loader2 } from "lucide-react"
import { buildGrowthCampaignsHubHealthItems } from "@/lib/growth/hubs/growth-campaigns-hub-operator-health"
import { useGrowthCampaignsHubMetrics } from "@/components/growth/hubs/campaigns/use-growth-campaigns-hub-metrics"
import { cn } from "@/lib/utils"

export function GrowthCampaignsHubOperatorHealth() {
  const { loading, metrics } = useGrowthCampaignsHubMetrics()
  const items = buildGrowthCampaignsHubHealthItems(metrics)

  return (
    <section
      id="campaign-health"
      aria-labelledby="campaigns-hub-operator-health-heading"
      data-section="campaign-health"
    >
      <h2 id="campaigns-hub-operator-health-heading" className="mb-3 text-lg font-semibold text-foreground">
        Campaign Health
      </h2>
      {loading ? (
        <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/10 px-3 py-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading campaign health…
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex min-h-[4.5rem] flex-col justify-center rounded-xl border border-border/70 bg-background px-4 py-3 text-sm transition-colors hover:border-primary/30 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                item.status === "red" && "border-red-200 bg-red-50/40",
                item.status === "yellow" && "border-amber-200 bg-amber-50/40",
              )}
              data-operator-health={item.id}
              data-health-status={item.status}
            >
              <span className="flex items-center gap-2 font-medium text-foreground">
                <span aria-hidden>{item.emoji}</span>
                {item.label}
              </span>
              <span className="mt-1 tabular-nums text-muted-foreground">{item.count.toLocaleString()}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
