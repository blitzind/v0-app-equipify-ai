"use client"

import type { GrowthHomeMilestone } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_CONTINUITY_MILESTONES_TITLE } from "@/lib/workspace/ai-relationship-continuity"

type Props = {
  milestones: GrowthHomeMilestone[]
}

export function GrowthHomeMilestonesSection({ milestones }: Props) {
  if (milestones.length === 0) return null

  return (
    <section data-qa-section="home-milestones" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_CONTINUITY_MILESTONES_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Meaningful progress worth celebrating.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {milestones.map((milestone) => (
          <article
            key={milestone.id}
            className="rounded-xl border border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20 p-4"
          >
            <p className="text-base font-semibold text-foreground">
              <span aria-hidden className="mr-2">
                {milestone.emoji}
              </span>
              {milestone.headline}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{milestone.detail}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
