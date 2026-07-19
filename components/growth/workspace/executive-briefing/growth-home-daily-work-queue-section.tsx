"use client"

import Link from "next/link"
import type {
  GrowthHomeDailyWorkQueueBuckets,
  GrowthHomeDailyWorkQueueItem,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { GrowthHomeConfidenceBadge } from "@/components/growth/workspace/executive-briefing/growth-home-confidence-badge"

const PRIORITY_LABELS: Record<GrowthHomeDailyWorkQueueItem["priority"], string> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
}

const BUCKET_LABELS: Array<{ key: keyof GrowthHomeDailyWorkQueueBuckets; label: string }> = [
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "waiting", label: "Waiting" },
]

export function GrowthHomeDailyWorkQueueSection({
  items,
  buckets,
}: {
  items: GrowthHomeDailyWorkQueueItem[]
  buckets?: GrowthHomeDailyWorkQueueBuckets | null
}) {
  if (items.length === 0 && !buckets) return null

  return (
    <section data-qa-section="home-daily-work-queue" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Today&apos;s highest-value work</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Prioritized from the canonical daily revenue work queue.
        </p>
      </div>

      {buckets ? (
        <div className="grid gap-3 sm:grid-cols-4">
          {BUCKET_LABELS.map(({ key, label }) => (
            <div key={key} className="rounded-lg border border-border/60 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{buckets[key]}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => {
          const body = (
            <article className="rounded-xl border border-border/70 bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground">
                    {PRIORITY_LABELS[item.priority]}
                  </p>
                  <p className="text-lg font-semibold text-foreground">{item.companyName}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.actionLabel}
                    {item.channelLabel ? ` · ${item.channelLabel}` : ""}
                  </p>
                  {item.reason ? <p className="text-sm text-muted-foreground">{item.reason}</p> : null}
                  {item.estimatedMinutes ? (
                    <p className="text-xs text-muted-foreground">~{item.estimatedMinutes} min</p>
                  ) : null}
                  {item.requiresHumanApproval ? (
                    <p className="text-xs font-medium text-amber-700">Awaiting your review</p>
                  ) : null}
                </div>
                <GrowthHomeConfidenceBadge
                  percent={item.confidencePercent}
                  label={item.confidenceLabel}
                />
              </div>
            </article>
          )

          return item.href ? (
            <Link key={item.id} href={item.href} className="block transition-opacity hover:opacity-90">
              {body}
            </Link>
          ) : (
            <div key={item.id}>{body}</div>
          )
        })}
      </div>
    </section>
  )
}
