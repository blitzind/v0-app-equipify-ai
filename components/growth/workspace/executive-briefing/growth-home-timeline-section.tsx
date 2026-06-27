"use client"

import type { GrowthHomeTimelinePeriod } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"

export function GrowthHomeTimelineSection({ periods }: { periods: GrowthHomeTimelinePeriod[] }) {
  if (periods.every((period) => period.items.length === 0)) return null

  return (
    <section data-qa-section="home-timeline" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Timeline</h2>
        <p className="mt-1 text-sm text-muted-foreground">Recent work in first-person narrative.</p>
      </div>
      <div className="space-y-6">
        {periods.map((period) => (
          <div key={period.id}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{period.periodLabel}</p>
            <ul className="mt-3 space-y-2">
              {period.items.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-foreground">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
