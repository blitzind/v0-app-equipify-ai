"use client"

import type { GrowthHomeTimelinePeriod } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  GROWTH_HOME_AVA_ACCOMPLISHED_SUBTITLE,
  GROWTH_HOME_AVA_ACCOMPLISHED_TITLE,
} from "@/lib/growth/workspace/executive-briefing/growth-home-premium-ux-1a"

export function GrowthHomeTimelineSection({ periods }: { periods: GrowthHomeTimelinePeriod[] }) {
  if (periods.every((period) => period.items.length === 0)) return null

  return (
    <section
      data-qa-section="home-timeline"
      className="rounded-2xl border border-border/70 bg-card p-6 space-y-5"
    >
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{GROWTH_HOME_AVA_ACCOMPLISHED_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{GROWTH_HOME_AVA_ACCOMPLISHED_SUBTITLE}</p>
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
