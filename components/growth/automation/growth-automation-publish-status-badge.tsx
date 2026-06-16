"use client"

import { cn } from "@/lib/utils"

type Props = {
  status: string
  readiness?: string | null
  className?: string
}

export function GrowthAutomationPublishStatusBadge({ status, readiness, className }: Props) {
  const tone =
    status === "published"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : status === "archived"
        ? "bg-muted text-muted-foreground"
        : readiness === "ready"
          ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
          : "bg-amber-500/10 text-amber-700 dark:text-amber-300"

  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide", tone, className)}>
      {status}
      {readiness ? ` · ${readiness}` : ""}
    </span>
  )
}
