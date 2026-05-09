"use client"

/**
 * Communications Center Phase 3 — vertical lifecycle timeline.
 *
 * Renders the sequence of states a `communication_event` has passed
 * through (Created → Queued → Sent → Delivered, with branches for
 * Failed / Bounced / Simulated / Draft). Used inside the right-side
 * detail drawer.
 */

import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/notifications/format-relative"
import type { LifecycleStep, LifecycleTone } from "@/lib/communications/lifecycle"

const TONE_DOT: Record<LifecycleTone, string> = {
  muted: "bg-muted-foreground/40 ring-muted/40",
  info: "bg-sky-500 ring-sky-500/20",
  success: "bg-emerald-500 ring-emerald-500/20",
  warning: "bg-amber-500 ring-amber-500/20",
  danger: "bg-red-500 ring-red-500/20",
  violet: "bg-violet-500 ring-violet-500/20",
}

const TONE_LABEL: Record<LifecycleTone, string> = {
  muted: "text-muted-foreground",
  info: "text-sky-700 dark:text-sky-300",
  success: "text-emerald-700 dark:text-emerald-300",
  warning: "text-amber-700 dark:text-amber-300",
  danger: "text-red-700 dark:text-red-300",
  violet: "text-violet-700 dark:text-violet-300",
}

export function LifecycleTimeline({ steps }: { steps: LifecycleStep[] }) {
  if (steps.length === 0) return null
  return (
    <ol className="relative pl-5">
      <span
        className="absolute left-[7px] top-1 bottom-1 w-px bg-border"
        aria-hidden
      />
      {steps.map((step) => (
        <li key={step.id} className="relative pb-4 last:pb-0">
          <span
            className={cn(
              "absolute -left-[19px] top-[6px] h-3 w-3 rounded-full ring-4",
              TONE_DOT[step.tone],
              step.current && "shadow-[0_0_0_2px_hsl(var(--background))]",
            )}
            aria-hidden
          />
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className={cn("text-xs font-semibold", TONE_LABEL[step.tone])}>
              {step.label}
            </span>
            {step.iso ? (
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {formatRelativeTime(step.iso)}
              </span>
            ) : null}
          </div>
          {step.detail ? (
            <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
              {step.detail}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
