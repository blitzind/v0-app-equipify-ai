"use client"

import type { GrowthAvaOperationalItem } from "@/lib/growth/cognitive-workspace/growth-cognitive-workspace-types"

type Props = {
  items: GrowthAvaOperationalItem[]
}

export function GrowthAvaOperationalStatePanel({ items }: Props) {
  if (items.length === 0) return null

  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border border-border/50 bg-muted/15 px-3 py-2">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 font-medium text-foreground">{item.value}</dd>
          {item.note ? <p className="mt-1 text-xs text-muted-foreground">{item.note}</p> : null}
        </div>
      ))}
    </dl>
  )
}
