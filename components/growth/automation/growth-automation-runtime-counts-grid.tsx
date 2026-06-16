"use client"

import type { GrowthAutomationRuntimeCounts } from "@/lib/growth/automation/growth-automation-observability-types"

type Props = {
  counts: GrowthAutomationRuntimeCounts | null
}

const ITEMS: Array<{ key: keyof GrowthAutomationRuntimeCounts; label: string }> = [
  { key: "totalEnrollments", label: "Total" },
  { key: "activeEnrollments", label: "Active" },
  { key: "waitingEnrollments", label: "Waiting" },
  { key: "approvalRequiredEnrollments", label: "Approval" },
  { key: "completedEnrollments", label: "Completed" },
  { key: "failedEnrollments", label: "Failed" },
  { key: "cancelledEnrollments", label: "Cancelled" },
  { key: "pendingApprovalJobs", label: "Pending jobs" },
  { key: "approvedButNotExecutedJobs", label: "Approved · no send" },
  { key: "rejectedJobs", label: "Rejected jobs" },
  { key: "stuckWaits", label: "Stuck waits" },
]

export function GrowthAutomationRuntimeCountsGrid({ counts }: Props) {
  if (!counts) return null

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {ITEMS.map((item) => (
        <div key={item.key} className="rounded-md border border-border/70 p-2 text-xs">
          <p className="text-muted-foreground">{item.label}</p>
          <p className="mt-1 text-lg font-semibold">{counts[item.key]}</p>
        </div>
      ))}
    </div>
  )
}
