"use client"

import Link from "next/link"
import type { GrowthHomeWaitingOnYouItem } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_OWNERSHIP_WAITING_ON_YOU_TITLE } from "@/lib/workspace/ai-ownership-accountability"
import { Button } from "@/components/ui/button"

type Props = {
  items: GrowthHomeWaitingOnYouItem[]
  overflowCount?: number
}

export function GrowthHomeWaitingOnYouSection({ items, overflowCount = 0 }: Props) {
  if (items.length === 0) return null

  return (
    <section data-qa-section="home-waiting-on-you" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_OWNERSHIP_WAITING_ON_YOU_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">The primary actions that need you before I can continue.</p>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-amber-200/80 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20"
          >
            <div className="min-w-0 space-y-1">
              <p className="font-medium text-foreground">{item.label}</p>
              <p className="text-sm text-muted-foreground">{item.detail}</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={item.href}>Review</Link>
            </Button>
          </article>
        ))}
      </div>
      {overflowCount > 0 ? (
        <p className="text-sm text-muted-foreground">{overflowCount} more items collapsed — open additional tools below.</p>
      ) : null}
    </section>
  )
}
