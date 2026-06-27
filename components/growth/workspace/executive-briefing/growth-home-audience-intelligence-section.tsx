"use client"

import type { GrowthHomeAudienceInsight } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_MARKETING_AUDIENCE_INTELLIGENCE_TITLE } from "@/lib/workspace/ai-autonomous-marketing-operator"

type Props = {
  items: GrowthHomeAudienceInsight[]
}

export function GrowthHomeAudienceIntelligenceSection({ items }: Props) {
  if (items.length === 0) return null

  return (
    <section data-qa-section="home-audience-intelligence" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_MARKETING_AUDIENCE_INTELLIGENCE_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Audience signals from engagement and inbox read models.</p>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border border-indigo-100 bg-indigo-50/40 dark:border-indigo-900/40 dark:bg-indigo-950/20 p-4">
            <p className="text-base font-medium leading-relaxed text-foreground">{item.insight}</p>
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
