"use client"

import Link from "next/link"
import type { GrowthHomeNoticedItem } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_PROACTIVE_THINGS_NOTICED_TITLE } from "@/lib/workspace/ai-proactive-initiative"

type Props = {
  items: GrowthHomeNoticedItem[]
}

export function GrowthHomeThingsNoticedSection({ items }: Props) {
  if (items.length === 0) return null

  return (
    <section data-qa-section="home-things-i-noticed" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_PROACTIVE_THINGS_NOTICED_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Observations backed by evidence from your workspace.</p>
      </div>
      <div className="space-y-3">
        {items.map((item) => {
          const inner = (
            <article className="rounded-xl border border-border/60 bg-card p-4">
              <p className="text-base font-medium leading-relaxed text-foreground">{item.observation}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-medium">Evidence · </span>
                {item.evidence}
              </p>
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
