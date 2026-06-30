"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GROWTH_LEADS_HUB_KPI_CARDS } from "@/lib/growth/hubs/growth-leads-hub-config"
import { recordGrowthLeadsActivity } from "@/lib/growth/hubs/growth-leads-recent-work-memory"
import { useGrowthLeadsHubMetrics } from "@/components/growth/hubs/leads/use-growth-leads-hub-metrics"
import { cn } from "@/lib/utils"

export function GrowthLeadsHubKpiStrip() {
  const { loading, metrics } = useGrowthLeadsHubMetrics()

  return (
    <section aria-labelledby="leads-hub-kpi-heading" data-section="kpi-strip">
      <GrowthEngineCard title="Today at a Glance" data-section="overview">
        <h2 id="leads-hub-kpi-heading" className="sr-only">
          Lead operations KPIs
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {GROWTH_LEADS_HUB_KPI_CARDS.map((metric) => {
            const value = metrics[metric.metricKey]
            const displayValue =
              value != null ? value.toLocaleString() : loading ? "…" : metric.emptyValue
            return (
              <Link
                key={metric.id}
                href={metric.href}
                onClick={() =>
                  recordGrowthLeadsActivity({
                    id: `${metric.id}:${metric.href}`,
                    verb: "Opened",
                    label: metric.label,
                    href: metric.href,
                  })
                }
                aria-label={`${metric.label}. ${metric.helper}.`}
                className={cn(
                  "group block rounded-xl border border-border/80 bg-background p-4 shadow-sm transition-all",
                  "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  "cursor-pointer",
                )}
                data-kpi-id={metric.id}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {metric.label}
                  </span>
                  <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                    aria-hidden
                  />
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{displayValue}</div>
                <p className="mt-1 text-xs text-muted-foreground">{metric.helper}</p>
                {loading && value == null ? (
                  <p className="mt-1 text-[11px] text-muted-foreground/80">Loading metrics…</p>
                ) : null}
              </Link>
            )
          })}
        </div>
      </GrowthEngineCard>
    </section>
  )
}
