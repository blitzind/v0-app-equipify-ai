"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GROWTH_INBOX_RECENT_WORK_STORAGE_KEY } from "@/lib/growth/hubs/growth-inbox-recent-work-memory"
import {
  formatGrowthInboxActivityLine,
  formatGrowthInboxActivityRelativeTime,
  readGrowthInboxActivityTimeline,
  type GrowthInboxActivityItem,
} from "@/lib/growth/hubs/growth-inbox-recent-work-memory"

export function GrowthInboxActivityTimeline() {
  const [items, setItems] = useState<GrowthInboxActivityItem[]>([])

  useEffect(() => {
    function refresh() {
      setItems(readGrowthInboxActivityTimeline())
    }
    refresh()
    window.addEventListener("storage", refresh)
    return () => window.removeEventListener("storage", refresh)
  }, [])

  if (items.length === 0) return null

  return (
    <section aria-labelledby="inbox-hub-activity-heading" data-section="recent-activity">
      <GrowthEngineCard title="Recent Activity">
        <h2 id="inbox-hub-activity-heading" className="sr-only">
          Recent activity
        </h2>
        <ol className="relative space-y-0 border-l border-border/80 pl-4">
          {items.slice(0, 8).map((item) => (
            <li key={`${item.id}-${item.viewedAt}`} className="relative pb-4 last:pb-0">
              <span
                className="absolute -left-[1.35rem] top-1.5 size-2.5 rounded-full border-2 border-background bg-primary"
                aria-hidden
              />
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <time className="text-xs font-medium text-muted-foreground">
                    {formatGrowthInboxActivityRelativeTime(item.viewedAt)}
                  </time>
                  <Link
                    href={item.href}
                    className="mt-1 block text-sm font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    {formatGrowthInboxActivityLine(item)}
                  </Link>
                </div>
                <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground sm:mt-2" aria-hidden />
              </div>
            </li>
          ))}
        </ol>
      </GrowthEngineCard>
      <span className="sr-only" data-recent-work-storage-key={GROWTH_INBOX_RECENT_WORK_STORAGE_KEY} />
    </section>
  )
}
