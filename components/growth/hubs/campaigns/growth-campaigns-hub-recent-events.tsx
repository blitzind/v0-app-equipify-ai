"use client"

import { Loader2 } from "lucide-react"
import { GrowthEngineCard, GrowthBadge } from "@/components/growth/growth-ui-utils"
import { formatGrowthCampaignsRelativeTime } from "@/lib/growth/hubs/growth-campaigns-hub-active-campaigns"
import { useGrowthCampaignsHubMetrics } from "@/components/growth/hubs/campaigns/use-growth-campaigns-hub-metrics"

export function GrowthCampaignsHubRecentEvents() {
  const { loading, metrics } = useGrowthCampaignsHubMetrics()
  const events = metrics.recentEvents.slice(0, 8)

  return (
    <section aria-labelledby="campaigns-hub-recent-events-heading" data-section="recent-events">
      <GrowthEngineCard title="Recent Events">
        <h2 id="campaigns-hub-recent-events-heading" className="sr-only">
          Recent events
        </h2>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading events…
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent campaign events yet.</p>
        ) : (
          <ol className="space-y-3">
            {events.map((event) => (
              <li key={event.id} className="flex gap-3 text-sm">
                <time className="w-16 shrink-0 tabular-nums text-xs text-muted-foreground">
                  {formatGrowthCampaignsRelativeTime(event.createdAt)}
                </time>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <GrowthBadge label={event.eventType.replace(/_/g, " ")} tone="neutral" />
                    <span className="font-medium text-foreground">{event.title}</span>
                  </div>
                  {event.description ? (
                    <p className="mt-1 text-xs text-muted-foreground">{event.description}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </GrowthEngineCard>
    </section>
  )
}
