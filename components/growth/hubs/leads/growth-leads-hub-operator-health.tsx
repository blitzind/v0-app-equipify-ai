"use client"

import { Loader2 } from "lucide-react"
import { buildGrowthLeadsOperatorHealthItems } from "@/lib/growth/hubs/growth-leads-hub-operator-health"
import { useGrowthLeadsHubMetrics } from "@/components/growth/hubs/leads/use-growth-leads-hub-metrics"
import { cn } from "@/lib/utils"

export function GrowthLeadsHubOperatorHealth() {
  const { loading, metrics } = useGrowthLeadsHubMetrics()
  const items = buildGrowthLeadsOperatorHealthItems(metrics)

  return (
    <section aria-labelledby="leads-hub-operator-health-heading" data-section="operator-health">
      <h2 id="leads-hub-operator-health-heading" className="sr-only">
        Operator health
      </h2>
      {loading ? (
        <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/10 px-3 py-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading operator health…
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "inline-flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 text-sm",
                item.status === "red" && "border-red-200 bg-red-50/40",
                item.status === "yellow" && "border-amber-200 bg-amber-50/40",
              )}
              data-operator-health={item.id}
              data-health-status={item.status}
            >
              <span aria-hidden>{item.emoji}</span>
              <span className="font-medium text-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
