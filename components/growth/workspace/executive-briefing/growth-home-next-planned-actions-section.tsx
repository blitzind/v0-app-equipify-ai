"use client"

import type { GrowthHomePlannedAction } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_REVENUE_NEXT_PLANNED_ACTIONS_TITLE } from "@/lib/workspace/ai-autonomous-revenue-operator"

type Props = {
  actions: GrowthHomePlannedAction[]
}

export function GrowthHomeNextPlannedActionsSection({ actions }: Props) {
  if (actions.length === 0) return null

  return (
    <section data-qa-section="home-next-planned-actions" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_REVENUE_NEXT_PLANNED_ACTIONS_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Planned next steps from existing workflow state — rendered when applicable, no scheduler.
        </p>
      </div>
      <div className="space-y-3">
        {actions.map((action) => (
          <article key={action.id} className="rounded-xl border border-border/60 bg-card p-4">
            <p className="text-base font-medium leading-relaxed text-foreground">{action.summary}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium">Evidence · </span>
              {action.evidence}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
