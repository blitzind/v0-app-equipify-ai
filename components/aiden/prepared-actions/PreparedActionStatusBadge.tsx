"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<string, string> = {
  prepared: "bg-slate-500/15 text-slate-800 dark:text-slate-200",
  needs_clarification: "bg-amber-500/15 text-amber-900 dark:text-amber-100",
  ready_for_confirmation: "bg-sky-500/15 text-sky-900 dark:text-sky-100",
  confirmed: "bg-violet-500/15 text-violet-900 dark:text-violet-100",
  executing: "bg-violet-500/15 text-violet-900 dark:text-violet-100",
  completed: "bg-emerald-600/15 text-emerald-900 dark:text-emerald-100",
  canceled: "bg-muted text-muted-foreground",
  failed: "bg-destructive/15 text-destructive",
}

function labelForStatus(status: string): string {
  switch (status) {
    case "ready_for_confirmation":
      return "Ready for review"
    case "needs_clarification":
      return "Needs clarification"
    default:
      return status.replace(/_/g, " ")
  }
}

export function PreparedActionStatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-secondary text-secondary-foreground"
  return (
    <Badge variant="secondary" className={cn("text-[10px] font-medium capitalize", cls)}>
      {labelForStatus(status)}
    </Badge>
  )
}
