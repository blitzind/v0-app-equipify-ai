"use client"

import type { GrowthHomeSinceWeLastMetItem } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_CONTINUITY_SINCE_WE_LAST_MET_TITLE } from "@/lib/workspace/ai-relationship-continuity"

const CATEGORY_LABELS: Record<GrowthHomeSinceWeLastMetItem["category"], string> = {
  completed: "Completed",
  changed: "Changed",
  improved: "Improved",
  escalated: "Escalated",
  waiting: "Waiting",
}

type Props = {
  items: GrowthHomeSinceWeLastMetItem[]
}

export function GrowthHomeSinceWeLastMetSection({ items }: Props) {
  if (items.length === 0) return null

  return (
    <section data-qa-section="home-since-we-last-met" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_CONTINUITY_SINCE_WE_LAST_MET_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Meaningful progress since your previous session.</p>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border border-border/60 bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
              {CATEGORY_LABELS[item.category]}
            </p>
            <p className="mt-1 text-base font-medium leading-relaxed text-foreground">{item.summary}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium">Evidence · </span>
              {item.evidence}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
