"use client"

import Link from "next/link"
import type { GrowthHomeWhatChangedItem } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_CONTINUITY_WHAT_CHANGED_TITLE } from "@/lib/workspace/ai-relationship-continuity"

type Props = {
  items: GrowthHomeWhatChangedItem[]
}

export function GrowthHomeWhatChangedSection({ items }: Props) {
  if (items.length === 0) return null

  return (
    <section data-qa-section="home-what-changed" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_CONTINUITY_WHAT_CHANGED_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Deltas only — what moved since you were last here.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const inner = (
            <article className="rounded-xl border border-border/60 bg-card p-4 h-full">
              <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{item.label}</p>
              <p className="mt-1 text-base leading-relaxed text-foreground">{item.detail}</p>
            </article>
          )

          if (item.href) {
            return (
              <Link key={item.id} href={item.href} className="block transition-colors hover:opacity-90">
                {inner}
              </Link>
            )
          }

          return <div key={item.id}>{inner}</div>
        })}
      </div>
    </section>
  )
}
