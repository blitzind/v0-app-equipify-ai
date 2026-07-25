"use client"

import {
  GROWTH_HOME_SIMPLIFICATION_1A_QA_MARKER,
  GROWTH_HOME_SIMPLIFICATION_PROGRESS_TITLE,
  type GrowthHomeSimplifiedProgressCard,
} from "@/lib/growth/home/growth-home-simplification-1a"

type Props = {
  cards: GrowthHomeSimplifiedProgressCard[]
}

export function GrowthHomeAvaSimplifiedProgressSection({ cards }: Props) {
  if (cards.length === 0) return null

  return (
    <section
      data-qa-section="home-ava-simplified-progress"
      data-qa-marker-simplification-1a={GROWTH_HOME_SIMPLIFICATION_1A_QA_MARKER}
      className="rounded-2xl border border-border/70 bg-card/70 p-4 sm:p-5"
    >
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {GROWTH_HOME_SIMPLIFICATION_PROGRESS_TITLE}
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <li key={card.id} className="rounded-lg border border-border/50 bg-background/60 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{card.value}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
