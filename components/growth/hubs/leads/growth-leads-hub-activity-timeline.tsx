"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GROWTH_LEADS_HUB_RECENT_WORK_EMPTY } from "@/lib/growth/hubs/growth-leads-hub-config"
import {
  formatGrowthLeadsActivityLine,
  formatGrowthLeadsActivityRelativeTime,
  GROWTH_LEADS_RECENT_WORK_STORAGE_KEY,
  readGrowthLeadsActivityTimeline,
  type GrowthLeadsActivityItem,
} from "@/lib/growth/hubs/growth-leads-recent-work-memory"

export function GrowthLeadsHubActivityTimeline() {
  const [items, setItems] = useState<GrowthLeadsActivityItem[]>([])

  useEffect(() => {
    function refresh() {
      setItems(readGrowthLeadsActivityTimeline())
    }
    refresh()
    window.addEventListener("storage", refresh)
    return () => window.removeEventListener("storage", refresh)
  }, [])

  return (
    <section aria-labelledby="leads-hub-activity-timeline-heading" data-section="activity-timeline">
      <GrowthEngineCard title="Activity Timeline" data-section="recent-work">
        <h2 id="leads-hub-activity-timeline-heading" className="sr-only">
          Activity timeline
        </h2>

        {items.length === 0 ? (
          <p className="whitespace-pre-line rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            {GROWTH_LEADS_HUB_RECENT_WORK_EMPTY}
          </p>
        ) : (
          <ol className="relative space-y-0 border-l border-border/80 pl-4">
            {items.map((item) => (
              <li key={`${item.id}-${item.viewedAt}`} className="relative pb-4 last:pb-0">
                <span
                  className="absolute -left-[1.35rem] top-1.5 size-2.5 rounded-full border-2 border-background bg-primary"
                  aria-hidden
                />
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <time className="text-xs font-medium text-muted-foreground">
                      {formatGrowthLeadsActivityRelativeTime(item.viewedAt)}
                    </time>
                    <Link
                      href={item.href}
                      className="mt-1 block text-sm font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      {formatGrowthLeadsActivityLine(item)}
                    </Link>
                  </div>
                  <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground sm:mt-2" aria-hidden />
                </div>
              </li>
            ))}
          </ol>
        )}
      </GrowthEngineCard>
      <span className="sr-only" data-recent-work-storage-key={GROWTH_LEADS_RECENT_WORK_STORAGE_KEY} />
    </section>
  )
}
