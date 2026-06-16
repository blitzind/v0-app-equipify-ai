"use client"

import type { GrowthAutomationJobAnalyticsStat } from "@/lib/growth/automation/growth-automation-analytics-types"

type Props = {
  jobStats: GrowthAutomationJobAnalyticsStat | null
}

export function GrowthAutomationJobAnalytics({ jobStats }: Props) {
  if (!jobStats) return null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-md border border-border/70 p-2 text-xs">
          <p className="text-muted-foreground">Pending approval</p>
          <p className="mt-1 text-lg font-semibold">{jobStats.pendingApprovalCount}</p>
        </div>
        <div className="rounded-md border border-border/70 p-2 text-xs">
          <p className="text-muted-foreground">Approved · no send</p>
          <p className="mt-1 text-lg font-semibold">{jobStats.approvedNotExecutedCount}</p>
        </div>
        <div className="rounded-md border border-border/70 p-2 text-xs">
          <p className="text-muted-foreground">Rejected</p>
          <p className="mt-1 text-lg font-semibold">{jobStats.rejectedCount}</p>
        </div>
      </div>

      {jobStats.actionTypeBreakdown.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium">Action breakdown</p>
          <div className="space-y-1">
            {jobStats.actionTypeBreakdown.map((entry) => (
              <div
                key={entry.actionType}
                className="flex items-center justify-between rounded-md border border-border/70 px-2 py-1 text-xs"
              >
                <span className="truncate">{entry.actionType}</span>
                <span className="font-medium">{entry.count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No pending job action breakdown yet.</p>
      )}
    </div>
  )
}
