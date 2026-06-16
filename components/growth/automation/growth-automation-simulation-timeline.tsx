"use client"

import type { GrowthAutomationSimulationResult } from "@/lib/growth/automation/growth-automation-simulation-types"

type Props = {
  simulation: GrowthAutomationSimulationResult | null
  loading?: boolean
}

export function GrowthAutomationSimulationTimeline({ simulation, loading }: Props) {
  if (loading) {
    return <p className="text-xs text-muted-foreground">Running simulation…</p>
  }

  if (!simulation) {
    return <p className="text-xs text-muted-foreground">Run simulation to preview execution timeline.</p>
  }

  if (simulation.timeline.length === 0) {
    return <p className="text-xs text-muted-foreground">No timeline entries recorded.</p>
  }

  return (
    <ol className="space-y-2">
      {simulation.timeline.map((entry, index) => (
        <li key={`${entry.nodeId}-${entry.action}-${index}`} className="rounded-md border border-border/70 p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium capitalize">{entry.action.replaceAll("_", " ")}</span>
            <span className="text-[10px] text-muted-foreground">{entry.status}</span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {entry.nodeType} · {entry.nodeId.slice(0, 8)}…
          </p>
          {Object.keys(entry.details).length > 0 ? (
            <pre className="mt-2 overflow-x-auto rounded bg-muted/40 p-2 text-[10px] leading-relaxed">
              {JSON.stringify(entry.details, null, 2)}
            </pre>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
