"use client"

import type { GrowthAutomationRuntimeStuckWaitSnapshot } from "@/lib/growth/automation/growth-automation-observability-types"

type Props = {
  stuckWaits: GrowthAutomationRuntimeStuckWaitSnapshot[]
}

export function GrowthAutomationStuckWaitsPanel({ stuckWaits }: Props) {
  if (stuckWaits.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No stuck waits detected.</p>
    )
  }

  return (
    <div className="space-y-2">
      {stuckWaits.map((wait) => (
        <div key={wait.waitId} className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
          <p className="font-medium">{wait.waitKind} wait</p>
          <p className="mt-1 text-muted-foreground">{wait.detail}</p>
          <p className="mt-1 font-mono text-[10px] break-all">{wait.enrollmentId}</p>
        </div>
      ))}
    </div>
  )
}
