"use client"

import type { AiOsCommandCenterReadModel } from "@/lib/growth/aios/ai-os-command-center-types"
import { GROWTH_DAILY_REVENUE_WORK_QUEUE_PANEL_QA_MARKER } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-feature"
import { isDailyRevenueWorkQueueEnabledClient } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-feature"

type Bucket = {
  label: string
  count: number
  tone: string
}

function bucketRows(queue: NonNullable<AiOsCommandCenterReadModel["dailyRevenueWorkQueue"]>): Bucket[] {
  return [
    { label: "Critical", count: queue.critical?.length ?? 0, tone: "text-rose-700" },
    { label: "High", count: queue.high?.length ?? 0, tone: "text-amber-700" },
    { label: "Medium", count: queue.medium?.length ?? 0, tone: "text-indigo-700" },
    { label: "Waiting", count: queue.waiting?.length ?? 0, tone: "text-muted-foreground" },
    { label: "Blocked", count: queue.blocked?.length ?? 0, tone: "text-muted-foreground" },
  ]
}

export function GrowthAiOsDailyWorkQueueSection({
  queue,
  display,
}: {
  queue: AiOsCommandCenterReadModel["dailyRevenueWorkQueue"]
  display: AiOsCommandCenterReadModel["dailyRevenueWorkQueueDisplay"]
}) {
  if (!isDailyRevenueWorkQueueEnabledClient() || !queue || !display) return null

  const buckets = bucketRows(queue)
  const topItems = (display.top_items ?? []).slice(0, 6)

  return (
    <section
      className="space-y-4 rounded-xl border border-border/70 bg-background p-4"
      data-qa-marker={GROWTH_DAILY_REVENUE_WORK_QUEUE_PANEL_QA_MARKER}
    >
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          My daily work queue
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{display.channel_summary}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        {buckets.map((bucket) => (
          <div key={bucket.label} className="rounded-lg border border-border/60 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{bucket.label}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${bucket.tone}`}>{bucket.count}</p>
          </div>
        ))}
      </div>

      {topItems.length > 0 ? (
        <ul className="space-y-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-3">
          {topItems.map((item) => (
            <li key={`${item.lead_id}-${item.action_label}`} className="flex justify-between gap-3 text-sm">
              <span>
                {item.action_label} · {item.channel_label}
              </span>
              <span className="text-xs uppercase text-muted-foreground">{item.priority}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
