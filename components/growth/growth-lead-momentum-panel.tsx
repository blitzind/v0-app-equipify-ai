"use client"

import type { GrowthLead } from "@/lib/growth/types"
import { cn } from "@/lib/utils"

function tierClass(tier: GrowthLead["momentumTier"]) {
  switch (tier) {
    case "critical":
      return "text-rose-700"
    case "high":
      return "text-orange-700"
    case "medium":
      return "text-amber-700"
    default:
      return "text-muted-foreground"
  }
}

type GrowthLeadMomentumPanelProps = {
  lead: GrowthLead
}

export function GrowthLeadMomentumPanel({ lead }: GrowthLeadMomentumPanelProps) {
  const score = lead.momentumScore
  const tier = lead.momentumTier

  if (score == null) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
        Momentum will compute after workflow signals refresh.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-baseline gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Momentum</p>
        <p className="text-2xl font-bold tabular-nums">{score}</p>
        {tier ? <p className={cn("text-sm font-semibold uppercase", tierClass(tier))}>{tier}</p> : null}
      </div>
      {lead.momentumWhySummary ? (
        <div className="mt-3 text-sm text-foreground">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {lead.momentumWhySummary.split(" · ").map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {lead.agingBucket ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Aging: {lead.agingDays ?? "—"} days ({lead.agingBucket})
          {lead.timeToFirstTouchHours != null ? ` · First touch ${lead.timeToFirstTouchHours}h` : null}
        </p>
      ) : null}
    </div>
  )
}
