"use client"

import type { GrowthHomeMissionTimelineItem } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_REVENUE_MISSION_TIMELINE_TITLE } from "@/lib/workspace/ai-autonomous-revenue-operator"
import { formatRelativeTime } from "@/lib/notifications/format-relative"

type Props = {
  items: GrowthHomeMissionTimelineItem[]
}

export function GrowthHomeMissionTimelineSection({ items }: Props) {
  if (items.length === 0) return null

  return (
    <section data-qa-section="home-mission-timeline" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_REVENUE_MISSION_TIMELINE_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Mission progression — not raw system events.</p>
      </div>
      <ol className="space-y-3 border-l-2 border-indigo-200 pl-4 dark:border-indigo-900/50">
        {items.map((item) => (
          <li key={item.id} className="relative">
            <span className="absolute -left-[1.35rem] top-2 size-2.5 rounded-full bg-indigo-500" aria-hidden />
            <article className="rounded-xl border border-border/60 bg-card p-4">
              <p className="text-base leading-relaxed text-foreground">{item.summary}</p>
              {item.occurredAt ? (
                <p className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(item.occurredAt)}</p>
              ) : null}
            </article>
          </li>
        ))}
      </ol>
    </section>
  )
}
