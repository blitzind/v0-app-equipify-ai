"use client"

import { cn } from "@/lib/utils"
import type { GrowthAutomationEnrollmentStatus } from "@/lib/growth/automation/growth-automation-enrollment-types"

type Props = {
  status: GrowthAutomationEnrollmentStatus | string
  duplicate?: boolean
  className?: string
}

export function GrowthAutomationEnrollmentStatusBadge({ status, duplicate, className }: Props) {
  const tone =
    status === "enrolled"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : status === "completed"
        ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
        : status === "duplicate" || duplicate
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : status === "cancelled"
            ? "bg-muted text-muted-foreground"
            : status === "blocked" || status === "failed"
              ? "bg-red-500/10 text-red-700 dark:text-red-300"
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
