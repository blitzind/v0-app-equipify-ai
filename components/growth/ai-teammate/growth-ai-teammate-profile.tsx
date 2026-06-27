"use client"

import { Bot } from "lucide-react"
import type { AiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"
import { cn } from "@/lib/utils"

export type GrowthAiTeammateProfileProps = {
  teammate: AiTeammatePresentation
  statusLabel?: string
  activityLabel?: string | null
  lastUpdateLabel?: string | null
  variant?: "compact" | "card"
  className?: string
}

function statusTone(statusLabel: string): string {
  const lower = statusLabel.toLowerCase()
  if (lower.includes("waiting") || lower.includes("approval")) {
    return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
  }
  return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
}

export function GrowthAiTeammateProfile({
  teammate,
  statusLabel = "Working",
  activityLabel = null,
  lastUpdateLabel = null,
  variant = "card",
  className,
}: GrowthAiTeammateProfileProps) {
  if (variant === "compact") {
    return (
      <div
        className={cn(
          "hidden lg:flex items-center gap-2.5 rounded-lg border border-border/70 bg-muted/30 px-3 py-1.5",
          className,
        )}
        data-qa-section="ai-teammate-profile-compact"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
          <Bot className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-medium text-foreground">{teammate.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {activityLabel ?? statusLabel}
          </p>
        </div>
        <span
          className={cn("ml-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide", statusTone(statusLabel))}
        >
          {statusLabel}
        </span>
      </div>
    )
  }

  return (
    <article
      className={cn(
        "flex items-start gap-4 rounded-xl border border-border/70 bg-card p-4 shadow-sm",
        className,
      )}
      data-qa-section="ai-teammate-profile"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
        <Bot className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight">{teammate.name}</h2>
          <span
            className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", statusTone(statusLabel))}
          >
            {statusLabel}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{teammate.role}</p>
        {activityLabel ? (
          <p className="text-sm font-medium text-foreground">{activityLabel}</p>
        ) : null}
        {lastUpdateLabel ? (
          <p className="text-xs text-muted-foreground">Last update · {lastUpdateLabel}</p>
        ) : null}
      </div>
    </article>
  )
}
