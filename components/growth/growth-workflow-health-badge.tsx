"use client"

import { cn } from "@/lib/utils"
import type { GrowthWorkflowHealthStatus } from "@/lib/growth/workflow-health-types"

const LABELS: Record<GrowthWorkflowHealthStatus, string> = {
  healthy: "Healthy",
  needs_attention: "Needs attention",
  stalled: "Stalled",
  blocked: "Blocked",
}

function healthClass(status: GrowthWorkflowHealthStatus | null | undefined): string {
  switch (status) {
    case "healthy":
      return "border-emerald-200 bg-emerald-50 text-emerald-800"
    case "needs_attention":
      return "border-amber-200 bg-amber-50 text-amber-900"
    case "stalled":
      return "border-orange-200 bg-orange-50 text-orange-900"
    case "blocked":
      return "border-rose-200 bg-rose-50 text-rose-900"
    default:
      return "border-border bg-muted/30 text-muted-foreground"
  }
}

type GrowthWorkflowHealthBadgeProps = {
  status: GrowthWorkflowHealthStatus | null | undefined
  reason?: string | null
  className?: string
}

export function GrowthWorkflowHealthBadge({ status, reason, className }: GrowthWorkflowHealthBadgeProps) {
  if (!status) {
    return (
      <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium", healthClass(null), className)}>
        Unknown
      </span>
    )
  }

  return (
    <span
      className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium", healthClass(status), className)}
      title={reason ?? undefined}
    >
      {LABELS[status]}
    </span>
  )
}
