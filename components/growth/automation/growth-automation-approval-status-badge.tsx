"use client"

import { cn } from "@/lib/utils"
import type { GrowthAutomationApprovalStatus } from "@/lib/growth/automation/growth-automation-approval-types"

type Props = {
  status: GrowthAutomationApprovalStatus | string
  className?: string
}

export function GrowthAutomationApprovalStatusBadge({ status, className }: Props) {
  const tone =
    status === "pending"
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : status === "approved"
        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : status === "rejected"
          ? "bg-red-500/10 text-red-700 dark:text-red-300"
          : status === "cancelled" || status === "expired"
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
