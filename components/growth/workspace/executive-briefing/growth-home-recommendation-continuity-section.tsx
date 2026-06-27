"use client"

import type { GrowthHomeRecommendationContinuity } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_CONTINUITY_RECOMMENDATION_CONTINUITY_TITLE } from "@/lib/workspace/ai-relationship-continuity"

type Props = {
  items: GrowthHomeRecommendationContinuity[]
}

export function GrowthHomeRecommendationContinuitySection({ items }: Props) {
  if (items.length === 0) return null

  return (
    <section data-qa-section="home-recommendation-continuity" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_CONTINUITY_RECOMMENDATION_CONTINUITY_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">When recommendations shift, Ava explains why with evidence.</p>
      </div>
      <div className="space-y-4">
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border border-indigo-100 bg-indigo-50/40 dark:border-indigo-900/40 dark:bg-indigo-950/20 p-5 space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
              {item.headline}
            </p>
            <p className="text-sm text-muted-foreground">{item.previousStance}</p>
            <p className="text-base font-medium text-foreground">{item.currentStance}</p>
            <p className="text-sm leading-relaxed text-foreground">{item.reason}</p>
            <ul className="space-y-1.5">
              {item.evidence.map((line) => (
                <li key={line} className="text-sm text-muted-foreground">
                  <span className="font-medium">Evidence · </span>
                  {line}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}
