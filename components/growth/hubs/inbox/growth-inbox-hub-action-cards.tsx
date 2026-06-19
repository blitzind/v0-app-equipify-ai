"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import { useGrowthReplyIntelligenceDashboard } from "@/components/growth/inbox/use-growth-reply-intelligence-dashboard"
import { GROWTH_INBOX_HUB_ACTION_CARDS } from "@/lib/growth/hubs/growth-inbox-hub-config"
import { deriveGrowthInboxOverviewMetrics } from "@/lib/growth/inbox/growth-inbox-overview-metrics"
import { cn } from "@/lib/utils"

export function GrowthInboxHubActionCards() {
  const { threads } = useGrowthInboxWorkspace()
  const { dashboard } = useGrowthReplyIntelligenceDashboard({ deferLoad: true })
  const metrics = useMemo(
    () => deriveGrowthInboxOverviewMetrics({ threads, replyDashboard: dashboard }),
    [threads, dashboard],
  )

  return (
    <section aria-labelledby="inbox-hub-action-cards-heading" data-section="action-cards">
      <h2 id="inbox-hub-action-cards-heading" className="sr-only">
        Inbox action cards
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {GROWTH_INBOX_HUB_ACTION_CARDS.map((card) => {
          const value = metrics[card.metricKey]
          return (
            <Link
              key={card.id}
              href={card.href}
              className={cn(
                "group flex min-h-[7.5rem] flex-col justify-between rounded-xl border border-border/80 bg-card p-4 shadow-sm transition-all",
                "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              )}
              data-action-card={card.id}
            >
              <div>
                <p className="text-sm font-semibold text-foreground">{card.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{card.helper}</p>
              </div>
              <div className="mt-3 flex items-end justify-between gap-2">
                <span className="text-2xl font-semibold tabular-nums text-foreground">{value}</span>
                <span className="text-xs font-medium text-primary group-hover:underline">{card.cta}</span>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
