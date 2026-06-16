"use client"

import type { GrowthAutomationWaitAnalyticsStat } from "@/lib/growth/automation/growth-automation-analytics-types"

type Props = {
  waitStats: GrowthAutomationWaitAnalyticsStat[]
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—"
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`
  return `${(ms / 3_600_000).toFixed(1)}h`
}

export function GrowthAutomationWaitAnalytics({ waitStats }: Props) {
  if (waitStats.length === 0) {
    return <p className="text-xs text-muted-foreground">No wait metrics recorded yet.</p>
  }

  return (
    <div className="space-y-2">
      {waitStats.slice(0, 8).map((stat) => (
        <div key={stat.waitId} className="rounded-md border border-border/70 p-2 text-xs">
          <p className="font-medium truncate" title={stat.waitId}>
            Wait {stat.waitId.slice(0, 8)}…
          </p>
          <div className="mt-1 flex flex-wrap gap-3 text-muted-foreground">
            <span>active {stat.activeCount}</span>
            <span>resolved {stat.resolvedCount}</span>
            <span>timeout {stat.timeoutCount}</span>
            <span>stuck {stat.stuckCount}</span>
            <span>avg {formatDuration(stat.averageWaitDuration)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
