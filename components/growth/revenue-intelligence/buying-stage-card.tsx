"use client"

import { buyingStageTone, formatStage } from "@/lib/growth/revenue-intelligence/revenue-intelligence-ux"
import { ConfidenceBar } from "@/components/growth/revenue-intelligence/confidence-bar"
import { cn } from "@/lib/utils"

export function BuyingStageCard({
  stage,
  confidence,
  signalCount,
  compact = false,
}: {
  stage: string | null
  confidence: number | null
  signalCount?: number
  compact?: boolean
}) {
  if (!stage) {
    return (
      <p className="text-sm text-muted-foreground">Buying stage not assessed yet.</p>
    )
  }

  return (
    <div className={cn(compact ? "space-y-2" : "space-y-3")}>
      <span
        className={cn(
          "inline-flex rounded-full border px-3 py-1 text-sm font-medium capitalize",
          buyingStageTone(stage),
        )}
      >
        {formatStage(stage)}
      </span>
      {confidence != null ? <ConfidenceBar value={confidence} /> : null}
      {signalCount != null && signalCount > 0 ? (
        <p className="text-xs text-muted-foreground">{signalCount} observable signal(s)</p>
      ) : null}
      {!compact ? (
        <p className="text-xs text-amber-800">Candidate assessment — verify before outreach.</p>
      ) : null}
    </div>
  )
}
