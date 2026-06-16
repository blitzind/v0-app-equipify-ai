"use client"

import { cn } from "@/lib/utils"
import type { GrowthAutomationRuntimeExecutionStatus } from "@/lib/growth/automation/growth-automation-runtime-execution-types"

type Props = {
  status: GrowthAutomationRuntimeExecutionStatus | string
  className?: string
}

export function GrowthAutomationRuntimeExecutionStatusBadge({ status, className }: Props) {
  const tone =
    status === "advanced"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : status === "completed"
        ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
        : status === "approval_required"
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : status === "waiting"
            ? "bg-violet-500/10 text-violet-700 dark:text-violet-300"
            : status === "blocked" || status === "failed"
              ? "bg-red-500/10 text-red-700 dark:text-red-300"
              : status === "cancelled"
                ? "bg-muted text-muted-foreground"
                : "bg-muted text-muted-foreground"

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        tone,
        className,
      )}
    >
      {status}
    </span>
  )
}
