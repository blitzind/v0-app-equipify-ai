"use client"

import type { GrowthHomeWeeklyGoal } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_OWNERSHIP_WEEKLY_GOALS_TITLE } from "@/lib/workspace/ai-ownership-accountability"
import { GrowthHomeProgressBar } from "@/components/growth/workspace/executive-briefing/growth-home-progress-bar"

type Props = {
  goals: GrowthHomeWeeklyGoal[]
}

export function GrowthHomeWeeklyGoalsSection({ goals }: Props) {
  if (goals.length === 0) return null

  return (
    <section data-qa-section="home-weekly-goals" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_OWNERSHIP_WEEKLY_GOALS_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Progress against objectives from your current read models.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {goals.map((goal) => (
          <article key={goal.id} className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
            <div>
              <p className="font-medium text-foreground">{goal.label}</p>
              <p className="text-sm text-muted-foreground">{goal.targetLabel}</p>
            </div>
            <GrowthHomeProgressBar percent={goal.progressPercent} />
          </article>
        ))}
      </div>
    </section>
  )
}
