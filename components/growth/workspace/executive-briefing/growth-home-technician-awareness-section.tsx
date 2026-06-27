"use client"

import type { GrowthHomeTechnicianAwarenessItem } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_SERVICE_TECHNICIAN_AWARENESS_TITLE } from "@/lib/workspace/ai-autonomous-service-operator"

type Props = {
  items: GrowthHomeTechnicianAwarenessItem[]
}

export function GrowthHomeTechnicianAwarenessSection({ items }: Props) {
  if (items.length === 0) return null

  return (
    <section data-qa-section="home-technician-awareness" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_SERVICE_TECHNICIAN_AWARENESS_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Onboarding readiness signals for Equipify accounts.</p>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border border-sky-100 bg-sky-50/40 dark:border-sky-900/40 dark:bg-sky-950/20 p-4">
            <p className="text-base font-medium leading-relaxed text-foreground">{item.summary}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium">Evidence · </span>
              {item.evidence}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
