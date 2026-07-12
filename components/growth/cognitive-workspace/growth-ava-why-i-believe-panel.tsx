"use client"

import type { GrowthAvaBelief } from "@/lib/growth/cognitive-workspace/growth-cognitive-workspace-types"

type Props = {
  beliefs: GrowthAvaBelief[]
}

export function GrowthAvaWhyIBelievePanel({ beliefs }: Props) {
  if (beliefs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        I do not have enough research conclusions to explain my belief yet.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {beliefs.map((belief) => (
        <li
          key={belief.id}
          className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm leading-relaxed text-foreground"
          data-belief-source={belief.sourceKey}
        >
          {belief.text}
        </li>
      ))}
    </ul>
  )
}
