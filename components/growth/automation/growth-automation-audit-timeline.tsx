"use client"

import type { GrowthAutomationAuditTimelineEntry } from "@/lib/growth/automation/growth-automation-analytics-types"

type Props = {
  entries: GrowthAutomationAuditTimelineEntry[]
  limit?: number
}

export function GrowthAutomationAuditTimeline({ entries, limit = 20 }: Props) {
  const visible = entries.slice(0, limit)

  if (visible.length === 0) {
    return <p className="text-xs text-muted-foreground">No audit events recorded yet.</p>
  }

  return (
    <div className="space-y-2">
      {visible.map((entry, index) => (
        <div
          key={`${entry.timestamp}:${entry.eventType}:${entry.enrollmentId ?? "runtime"}:${index}`}
          className="rounded-md border border-border/70 p-2 text-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
              {entry.eventType.replaceAll("_", " ")}
            </span>
            <span className="text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</span>
          </div>
          <p className="mt-1">{entry.summary}</p>
          {entry.enrollmentId ? (
            <p className="mt-1 text-muted-foreground">Enrollment {entry.enrollmentId.slice(0, 8)}…</p>
          ) : null}
        </div>
      ))}
    </div>
  )
}
