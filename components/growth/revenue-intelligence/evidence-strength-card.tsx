"use client"

import {
  evidenceStrengthTone,
  formatLabel,
  type RevenueEvidenceStrength,
} from "@/lib/growth/revenue-intelligence/revenue-intelligence-ux"
import { cn } from "@/lib/utils"

const STRENGTH_BARS: Record<RevenueEvidenceStrength, number> = {
  strong: 4,
  moderate: 3,
  weak: 2,
  minimal: 1,
}

export function EvidenceStrengthCard({
  strength,
  evidenceCount,
}: {
  strength: RevenueEvidenceStrength
  evidenceCount: number
}) {
  const filled = STRENGTH_BARS[strength]

  return (
    <div className="space-y-2">
      <p className={cn("text-sm font-semibold capitalize", evidenceStrengthTone(strength))}>
        {formatLabel(strength)} evidence
      </p>
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              "h-2 flex-1 rounded-sm",
              i <= filled ? "bg-emerald-500" : "bg-muted",
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {evidenceCount} evidence item{evidenceCount === 1 ? "" : "s"} on record
      </p>
    </div>
  )
}
