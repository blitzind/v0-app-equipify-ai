"use client"

import type { GrowthHomeTrustExplanation } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_CONTINUITY_TRUST_TITLE } from "@/lib/workspace/ai-relationship-continuity"

type Props = {
  items: GrowthHomeTrustExplanation[]
}

export function GrowthHomeTrustSection({ items }: Props) {
  if (items.length === 0) return null

  return (
    <section data-qa-section="home-trust-explanations" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_CONTINUITY_TRUST_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">When confidence shifts, I explain the evidence.</p>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border border-border/60 bg-card p-4">
            <p
              className={`text-xs font-semibold uppercase tracking-wide ${
                item.direction === "increased"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              Confidence {item.direction}
            </p>
            <p className="mt-1 text-base leading-relaxed text-foreground">{item.summary}</p>
            <ul className="mt-2 space-y-1">
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
