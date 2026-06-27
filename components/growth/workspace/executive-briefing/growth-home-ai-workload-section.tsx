"use client"

import type { GrowthHomeAiWorkloadItem } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_OWNERSHIP_WORKLOAD_TITLE, progressBarLabel } from "@/lib/workspace/ai-ownership-accountability"

type Props = {
  items: GrowthHomeAiWorkloadItem[]
}

export function GrowthHomeAiWorkloadSection({ items }: Props) {
  if (items.length === 0) return null

  return (
    <section data-qa-section="home-ai-workload" className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">{AI_OWNERSHIP_WORKLOAD_TITLE}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="grid grid-cols-[6rem_1fr] items-center gap-3 text-xs">
            <span className="font-medium text-muted-foreground">{item.label}</span>
            <span className="font-mono text-foreground tracking-tight" aria-label={`${item.label} ${item.progressPercent}%`}>
              {progressBarLabel(item.progressPercent)}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
