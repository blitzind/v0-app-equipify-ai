"use client"

import type { GrowthHomeDailyBriefing } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"

type Props = {
  briefing: GrowthHomeDailyBriefing | null
}

export function GrowthHomeDailyBriefingSection({ briefing }: Props) {
  if (!briefing) return null

  return (
    <section data-qa-section="home-daily-briefing" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Daily Briefing</h2>
        <p className="mt-1 text-base font-medium text-foreground">{briefing.headline}</p>
      </div>
      <ul className="space-y-2 rounded-xl border border-border/60 bg-card p-4">
        {briefing.items.map((line) => (
          <li key={line} className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-indigo-400" aria-hidden />
            {line}
          </li>
        ))}
      </ul>
    </section>
  )
}
