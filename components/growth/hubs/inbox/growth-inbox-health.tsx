"use client"

import Link from "next/link"
import { useMemo } from "react"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import { useGrowthReplyIntelligenceDashboard } from "@/components/growth/inbox/use-growth-reply-intelligence-dashboard"
import { buildGrowthInboxHubHealthItems } from "@/lib/growth/hubs/growth-inbox-hub-operator-health"
import { deriveGrowthInboxOverviewMetrics } from "@/lib/growth/inbox/growth-inbox-overview-metrics"
import { cn } from "@/lib/utils"

export function GrowthInboxHealth() {
  const { threads } = useGrowthInboxWorkspace()
  const { dashboard } = useGrowthReplyIntelligenceDashboard({ deferLoad: true })
  const metrics = useMemo(
    () => deriveGrowthInboxOverviewMetrics({ threads, replyDashboard: dashboard }),
    [threads, dashboard],
  )
  const items = buildGrowthInboxHubHealthItems(metrics)

  return (
    <section aria-labelledby="inbox-hub-health-heading" data-section="inbox-health">
      <h2 id="inbox-hub-health-heading" className="mb-2 text-sm font-semibold text-foreground">
        Inbox Health
      </h2>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              "inline-flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 text-sm transition-colors",
              "hover:border-primary/30 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              item.status === "red" && "border-red-200 bg-red-50/40",
              item.status === "yellow" && "border-amber-200 bg-amber-50/40",
            )}
            data-inbox-health={item.id}
            data-health-status={item.status}
          >
            <span aria-hidden>{item.emoji}</span>
            <span className="font-medium text-foreground">{item.label}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
