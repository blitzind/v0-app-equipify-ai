"use client"

import type { GrowthHomeMissionHealthSummary } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  AI_REVENUE_MISSION_HEALTH_LABELS,
  AI_REVENUE_MISSION_HEALTH_TITLE,
} from "@/lib/workspace/ai-autonomous-revenue-operator"

const HEALTH_TONE: Record<GrowthHomeMissionHealthSummary["health"], string> = {
  healthy: "border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100",
  waiting: "border-slate-200 bg-slate-50/70 text-slate-900 dark:border-slate-800 dark:bg-slate-950/20 dark:text-slate-100",
  blocked: "border-red-200 bg-red-50/70 text-red-900 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-100",
  needs_review: "border-amber-200 bg-amber-50/70 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100",
  completed: "border-indigo-200 bg-indigo-50/70 text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-950/20 dark:text-indigo-100",
}

type Props = {
  items: GrowthHomeMissionHealthSummary[]
}

export function GrowthHomeMissionHealthSection({ items }: Props) {
  if (items.length === 0) return null

  return (
    <section data-qa-section="home-mission-health" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_REVENUE_MISSION_HEALTH_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Derived from existing workflow and approval read models.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {items.map((item) => (
          <article
            key={item.health}
            className={`rounded-xl border p-4 ${HEALTH_TONE[item.health]}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide">{AI_REVENUE_MISSION_HEALTH_LABELS[item.health]}</p>
            <p className="mt-2 text-3xl font-semibold">{item.count}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
