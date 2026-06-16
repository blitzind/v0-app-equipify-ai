"use client"

import type { GrowthAutomationBranchAnalyticsStat } from "@/lib/growth/automation/growth-automation-analytics-types"

type Props = {
  branchStats: GrowthAutomationBranchAnalyticsStat[]
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—"
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`
  return `${(ms / 3_600_000).toFixed(1)}h`
}

export function GrowthAutomationBranchAnalytics({ branchStats }: Props) {
  if (branchStats.length === 0) {
    return <p className="text-xs text-muted-foreground">No branch decisions recorded yet.</p>
  }

  return (
    <div className="space-y-2">
      {branchStats.slice(0, 8).map((stat) => (
        <div key={stat.branchId} className="rounded-md border border-border/70 p-2 text-xs">
          <p className="font-medium truncate" title={stat.branchId}>
            Branch {stat.branchId.slice(0, 8)}…
          </p>
          <div className="mt-1 flex flex-wrap gap-3 text-muted-foreground">
            <span>true {stat.trueCount}</span>
            <span>false {stat.falseCount}</span>
            <span>timeout {stat.timeoutCount}</span>
            <span>avg {formatDuration(stat.averageDecisionTime)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
