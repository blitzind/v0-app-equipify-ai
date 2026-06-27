"use client"

import type { GrowthHomeServiceHealthItem } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_SERVICE_HEALTH_TITLE } from "@/lib/workspace/ai-autonomous-service-operator"

type Props = {
  items: GrowthHomeServiceHealthItem[]
}

export function GrowthHomeServiceHealthSection({ items }: Props) {
  if (items.length === 0) return null

  return (
    <section data-qa-section="home-service-health" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_SERVICE_HEALTH_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Human-readable health for Equipify customer accounts.</p>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border border-border/60 bg-card p-4">
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
