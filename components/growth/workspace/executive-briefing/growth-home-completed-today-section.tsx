"use client"

import type { GrowthHomeCompletedTodayItem } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_EMPLOYEE_COMPLETED_TODAY_TITLE } from "@/lib/workspace/ai-employee-experience"

type Props = {
  items: GrowthHomeCompletedTodayItem[]
}

export function GrowthHomeCompletedTodaySection({ items }: Props) {
  if (items.length === 0) return null

  return (
    <section data-qa-section="home-completed-today" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_EMPLOYEE_COMPLETED_TODAY_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Outcomes from your latest visit.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border border-border/60 bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
              {item.label}
            </p>
            <p className="mt-2 text-base font-medium text-foreground">{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
