"use client"

import Link from "next/link"
import { ArrowRight, Loader2 } from "lucide-react"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_LEADS_HUB_REVENUE_QUEUE_CARDS,
  growthLeadsHubRevenueQueueCardDetails,
} from "@/lib/growth/hubs/growth-leads-hub-config"
import { recordGrowthLeadsActivity } from "@/lib/growth/hubs/growth-leads-recent-work-memory"
import { useGrowthLeadsHubMetrics } from "@/components/growth/hubs/leads/use-growth-leads-hub-metrics"
import { cn } from "@/lib/utils"

export function GrowthLeadsHubRevenueQueueSummary() {
  const { loading, metrics } = useGrowthLeadsHubMetrics()

  return (
    <section aria-labelledby="leads-hub-revenue-summary-heading" data-section="revenue-queue-summary">
      <GrowthEngineCard title="Revenue Queue" data-section="revenue-queue-summary">
        <h2 id="leads-hub-revenue-summary-heading" className="sr-only">
          Revenue queue summary
        </h2>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading queue metrics…
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-3">
            {GROWTH_LEADS_HUB_REVENUE_QUEUE_CARDS.map((card) => {
              const details = growthLeadsHubRevenueQueueCardDetails(card.id, metrics)
              return (
                <Link
                  key={card.id}
                  href={card.href}
                  onClick={() =>
                    recordGrowthLeadsActivity({
                      id: `revenue-queue:${card.id}`,
                      verb: "Opened",
                      label: card.label,
                      href: card.href,
                    })
                  }
                  aria-label={`${card.label}. ${details.primary}. ${details.secondary}. ${details.tertiary}.`}
                  className={cn(
                    "group flex min-h-[9.5rem] flex-col rounded-xl border border-border/80 bg-background p-4 shadow-sm transition-all",
                    "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    "cursor-pointer",
                  )}
                  data-revenue-queue-card={card.id}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {card.label}
                  </span>
                  <span className="mt-2 text-xl font-semibold tabular-nums text-foreground">{details.primary}</span>
                  <p className="mt-2 text-sm text-muted-foreground">{details.secondary}</p>
                  <p className="text-sm text-muted-foreground">{details.tertiary}</p>
                  <span className="mt-auto inline-flex items-center pt-3 text-sm font-medium text-primary">
                    Open Queue
                    <ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </GrowthEngineCard>
    </section>
  )
}
