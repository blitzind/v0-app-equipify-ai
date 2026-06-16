"use client"

import { cn } from "@/lib/utils"
import type { GrowthAutomationRuntimeHealthSummary } from "@/lib/growth/automation/growth-automation-observability-types"

type Props = {
  health: GrowthAutomationRuntimeHealthSummary | null
  className?: string
}

export function GrowthAutomationRuntimeHealthCard({ health, className }: Props) {
  if (!health) {
    return (
      <div className={cn("rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground", className)}>
        Runtime health unavailable.
      </div>
    )
  }

  const tone =
    health.state === "healthy"
      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-100"
      : health.state === "attention"
        ? "border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-100"
        : health.state === "degraded"
          ? "border-orange-500/30 bg-orange-500/5 text-orange-900 dark:text-orange-100"
          : health.state === "blocked"
            ? "border-red-500/30 bg-red-500/5 text-red-900 dark:text-red-100"
            : "border-border bg-muted/20 text-muted-foreground"

  return (
    <div className={cn("rounded-md border p-3 text-xs", tone, className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium uppercase tracking-wide">{health.state}</p>
        {health.killSwitchEnabled ? (
          <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] uppercase">kill switch</span>
        ) : null}
      </div>
      <p className="mt-2">{health.summary}</p>
      {health.reasons.length > 1 ? (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
          {health.reasons.slice(1).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
