"use client"

import Link from "next/link"
import type { GrowthHomeContentPreparingItem } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_MARKETING_CONTENT_PREPARING_TITLE } from "@/lib/workspace/ai-autonomous-marketing-operator"

type Props = {
  items: GrowthHomeContentPreparingItem[]
}

export function GrowthHomeContentPreparingSection({ items }: Props) {
  if (items.length === 0) return null

  return (
    <section data-qa-section="home-content-preparing" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_MARKETING_CONTENT_PREPARING_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Drafts and assets from existing approval and campaign read models.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <Link key={item.id} href={item.href} className="block transition-colors hover:opacity-90">
            <article className="rounded-xl border border-border/60 bg-card p-4 h-full">
              <p className="font-semibold text-foreground">{item.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
            </article>
          </Link>
        ))}
      </div>
    </section>
  )
}
