"use client"

import { cn } from "@/lib/utils"

export function LeadScoreVisual({
  leadScore,
  intentScore,
  className,
}: {
  leadScore: number | null
  intentScore: number
  className?: string
}) {
  const display = leadScore ?? intentScore
  const tone =
    display >= 80 ? "text-emerald-700" : display >= 55 ? "text-sky-700" : display >= 30 ? "text-amber-700" : "text-muted-foreground"

  return (
    <div className={cn("flex items-end gap-3", className)}>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lead score</p>
        <p className={cn("text-3xl font-semibold tabular-nums", tone)}>{leadScore ?? "—"}</p>
      </div>
      <div className="pb-1">
        <p className="text-xs text-muted-foreground">Intent</p>
        <p className="text-lg font-medium tabular-nums text-foreground">{intentScore}</p>
      </div>
    </div>
  )
}
