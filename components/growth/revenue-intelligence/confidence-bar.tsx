"use client"

import { normalizeConfidence } from "@/lib/growth/revenue-intelligence/revenue-intelligence-ux"
import { cn } from "@/lib/utils"

export function ConfidenceBar({
  value,
  className,
  showLabel = true,
}: {
  value: number | null | undefined
  className?: string
  showLabel?: boolean
}) {
  const pct = Math.round(normalizeConfidence(value) * 100)
  return (
    <div className={cn("space-y-1", className)}>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct >= 70 ? "bg-emerald-500" : pct >= 45 ? "bg-sky-500" : "bg-amber-500",
          )}
          style={{ width: `${Math.max(4, pct)}%` }}
        />
      </div>
      {showLabel ? (
        <p className="text-xs text-muted-foreground">{pct}% confidence</p>
      ) : null}
    </div>
  )
}
