"use client"

import type { GrowthHomeCsExpansionOpportunity } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_CS_EXPANSION_OPPORTUNITIES_TITLE } from "@/lib/workspace/ai-autonomous-customer-success-operator"

type Props = {
  items: GrowthHomeCsExpansionOpportunity[]
}

export function GrowthHomeExpansionOpportunitiesSection({ items }: Props) {
  if (items.length === 0) return null

  return (
    <section data-qa-section="home-expansion-opportunities" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_CS_EXPANSION_OPPORTUNITIES_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Every recommendation includes evidence from read models.</p>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border border-violet-100 bg-violet-50/40 dark:border-violet-900/40 dark:bg-violet-950/20 p-4">
            <p className="text-base font-medium leading-relaxed text-foreground">{item.headline}</p>
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
