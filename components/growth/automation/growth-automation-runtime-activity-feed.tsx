"use client"

import type { GrowthAutomationRuntimeActivityEntry } from "@/lib/growth/automation/growth-automation-observability-types"

type Props = {
  activity: GrowthAutomationRuntimeActivityEntry[]
}

export function GrowthAutomationRuntimeActivityFeed({ activity }: Props) {
  if (activity.length === 0) {
    return <p className="text-xs text-muted-foreground">No recent runtime activity.</p>
  }

  return (
    <div className="space-y-2">
      {activity.map((entry) => (
        <div key={entry.activityId} className="rounded-md border border-border/60 p-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium capitalize">{entry.category}</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {entry.severity}
            </span>
          </div>
          <p className="mt-1">{entry.summary}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {new Date(entry.occurredAt).toLocaleString()}
            {entry.leadId ? ` · lead ${entry.leadId.slice(0, 8)}…` : ""}
          </p>
        </div>
      ))}
    </div>
  )
}
