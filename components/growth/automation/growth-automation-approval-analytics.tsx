"use client"

import type { GrowthAutomationApprovalAnalyticsStat } from "@/lib/growth/automation/growth-automation-analytics-types"

type Props = {
  approvalStats: GrowthAutomationApprovalAnalyticsStat | null
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—"
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`
  return `${(ms / 3_600_000).toFixed(1)}h`
}

export function GrowthAutomationApprovalAnalytics({ approvalStats }: Props) {
  if (!approvalStats) return null

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <div className="rounded-md border border-border/70 p-2 text-xs">
        <p className="text-muted-foreground">Total</p>
        <p className="mt-1 text-lg font-semibold">{approvalStats.approvalCount}</p>
      </div>
      <div className="rounded-md border border-border/70 p-2 text-xs">
        <p className="text-muted-foreground">Pending</p>
        <p className="mt-1 text-lg font-semibold">{approvalStats.pendingCount}</p>
      </div>
      <div className="rounded-md border border-border/70 p-2 text-xs">
        <p className="text-muted-foreground">Approved</p>
        <p className="mt-1 text-lg font-semibold">{approvalStats.approvedCount}</p>
      </div>
      <div className="rounded-md border border-border/70 p-2 text-xs">
        <p className="text-muted-foreground">Rejected</p>
        <p className="mt-1 text-lg font-semibold">{approvalStats.rejectedCount}</p>
      </div>
      <div className="rounded-md border border-border/70 p-2 text-xs">
        <p className="text-muted-foreground">Cancelled</p>
        <p className="mt-1 text-lg font-semibold">{approvalStats.cancelledCount}</p>
      </div>
      <div className="rounded-md border border-border/70 p-2 text-xs">
        <p className="text-muted-foreground">Avg review</p>
        <p className="mt-1 text-lg font-semibold">{formatDuration(approvalStats.averageApprovalTime)}</p>
      </div>
    </div>
  )
}
