"use client"

import type { GrowthAutomationAnalyticsCounts } from "@/lib/growth/automation/growth-automation-analytics-types"

type Props = {
  counts: GrowthAutomationAnalyticsCounts | null
}

const ITEMS: Array<{ key: keyof GrowthAutomationAnalyticsCounts; label: string }> = [
  { key: "totalEnrollments", label: "Total" },
  { key: "activeEnrollments", label: "Active" },
  { key: "waitingEnrollments", label: "Waiting" },
  { key: "approvalRequiredEnrollments", label: "Approval" },
  { key: "completedEnrollments", label: "Completed" },
  { key: "failedEnrollments", label: "Failed" },
  { key: "cancelledEnrollments", label: "Cancelled" },
  { key: "duplicateEnrollments", label: "Duplicates" },
]

export function GrowthAutomationRuntimeMetricsGrid({ counts }: Props) {
  if (!counts) return null

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {ITEMS.map((item) => (
        <div key={item.key} className="rounded-md border border-border/70 p-2 text-xs">
          <p className="text-muted-foreground">{item.label}</p>
          <p className="mt-1 text-lg font-semibold">{counts[item.key]}</p>
        </div>
      ))}
    </div>
  )
}
