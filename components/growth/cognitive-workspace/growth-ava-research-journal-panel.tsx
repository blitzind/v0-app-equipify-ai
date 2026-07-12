"use client"

import type { GrowthAvaResearchJournalEntry } from "@/lib/growth/cognitive-workspace/growth-cognitive-workspace-types"

type Props = {
  entries: GrowthAvaResearchJournalEntry[]
}

function formatWhen(iso: string | null): string {
  if (!iso) return "Unknown time"
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return iso
  return new Date(ms).toLocaleString()
}

export function GrowthAvaResearchJournalPanel({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        I do not have a research journal for this account yet.
      </p>
    )
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="relative border-l-2 border-border/70 pl-3">
          <p className="text-[11px] text-muted-foreground">{formatWhen(entry.at)}</p>
          <p className="text-sm font-medium text-foreground">{entry.title}</p>
          {entry.detail ? <p className="mt-0.5 text-sm text-muted-foreground">{entry.detail}</p> : null}
        </li>
      ))}
    </ol>
  )
}
