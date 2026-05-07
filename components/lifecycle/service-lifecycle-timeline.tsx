"use client"

import { cn } from "@/lib/utils"
import type { ServiceTimelineEvent } from "@/lib/lifecycle/service-timeline"

const TONE: Record<string, string> = {
  default: "bg-muted border-border text-foreground",
  info: "bg-[color:var(--status-info)]/10 border-[color:var(--status-info)]/25 text-foreground",
  success: "bg-[color:var(--status-success)]/10 border-[color:var(--status-success)]/25 text-foreground",
  warning: "bg-[color:var(--status-warning)]/10 border-[color:var(--status-warning)]/30 text-foreground",
  danger: "bg-destructive/10 border-destructive/25 text-foreground",
}

function fmtWhen(iso: string) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return "—"
  }
}

export function ServiceLifecycleTimeline({
  title = "Service timeline",
  events,
  emptyLabel = "No timeline events yet.",
  className,
}: {
  title?: string
  events: ServiceTimelineEvent[]
  emptyLabel?: string
  className?: string
}) {
  if (events.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className={cn("rounded-xl border border-border bg-card shadow-sm overflow-hidden", className)}>
      <div className="border-b border-border bg-muted/30 dark:bg-muted/15 px-4 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</p>
      </div>
      <ul className="divide-y divide-border/70">
        {events.map((e, i) => (
          <li key={e.id + String(i)} className="flex gap-3 px-4 py-3">
            <div className="flex flex-col items-center pt-0.5 shrink-0">
              <span
                className={cn(
                  "w-2 h-2 rounded-full border",
                  e.tone === "success"
                    ? "bg-[color:var(--status-success)] border-[color:var(--status-success)]"
                    : e.tone === "warning"
                      ? "bg-[color:var(--status-warning)] border-[color:var(--status-warning)]"
                      : e.tone === "danger"
                        ? "bg-destructive border-destructive"
                        : "bg-primary/70 border-primary",
                )}
              />
              {i < events.length - 1 ? (
                <span className="w-px flex-1 min-h-[12px] bg-border mt-1" aria-hidden />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <p className="text-sm font-medium text-foreground leading-snug">{e.label}</p>
                <time
                  className="text-[10px] text-muted-foreground tabular-nums shrink-0"
                  dateTime={e.at}
                >
                  {fmtWhen(e.at)}
                </time>
              </div>
              {e.detail ? (
                <p
                  className={cn(
                    "text-xs mt-1 rounded-md border px-2 py-1.5 inline-block max-w-full",
                    TONE[e.tone ?? "default"] ?? TONE.default,
                  )}
                >
                  {e.detail}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
